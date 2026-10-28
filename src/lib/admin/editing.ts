import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db";
import { documents, pages, posts, redirects, type ContentStatus, type SeoFields } from "@/db/schema";
import { mediaBaseUrl } from "@/lib/env";
import { RESERVED_SLUGS, slugify } from "./content";

// Shared helpers for the content editors (posts, pages, services, documents).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
export const uuidOrNull = (v: unknown): string | null => (isUuid(v) ? v : null);

const str = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? String(v[0] ?? "") : "");

/** Lagos is UTC+1 all year (no daylight saving). */
const LAGOS_OFFSET = "+01:00";

/** Date → "YYYY-MM-DDTHH:mm" in Africa/Lagos, for <input type="datetime-local">. */
export function toLagosInput(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromLagosInput(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00${LAGOS_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Status + publication date from the form. Without publish permission the
 * record is forced to draft (keeping any existing date).
 */
export function parseStatus(
  form: Record<string, unknown>,
  opts: { canPublish: boolean; existing?: { status: ContentStatus; publishedAt: Date | null } },
): { ok: true; status: ContentStatus; publishedAt: Date | null } | { ok: false; error: string } {
  const requested = str(form.status) as ContentStatus;
  // A missing or unknown value keeps the current status; it never silently unpublishes.
  const status: ContentStatus = ["draft", "scheduled", "published"].includes(requested) ? requested : (opts.existing?.status ?? "draft");
  const date = fromLagosInput(str(form.publishedAt));
  if (!opts.canPublish) {
    if (status !== "draft") return { ok: false, error: "Only editors can publish or schedule. Save as a draft and ask an editor to publish it." };
    return { ok: true, status: "draft", publishedAt: opts.existing?.publishedAt ?? null };
  }
  if (status === "scheduled") {
    if (!date) return { ok: false, error: "Choose the date and time to publish." };
    if (date.getTime() <= Date.now()) return { ok: false, error: "The scheduled time is in the past. Choose a future time, or publish now." };
    return { ok: true, status, publishedAt: date };
  }
  if (status === "published") {
    // Keep the original publication date unless the editor changed it.
    return { ok: true, status, publishedAt: date ?? opts.existing?.publishedAt ?? new Date() };
  }
  return { ok: true, status, publishedAt: date ?? opts.existing?.publishedAt ?? null };
}

/** SEO fields from "seo_*" form inputs; keeps imported Yoast values for the SEO report. */
export function parseSeo(form: Record<string, unknown>, existing?: SeoFields | null): SeoFields {
  const t = (k: string, max: number) => str(form[`seo_${k}`]).trim().slice(0, max) || undefined;
  const canonical = t("canonical", 500);
  return {
    title: t("title", 200),
    description: t("description", 400),
    canonical: canonical && /^https?:\/\//.test(canonical) ? canonical : undefined,
    noindex: str(form.seo_noindex) === "on" || undefined,
    nofollow: str(form.seo_nofollow) === "on" || undefined,
    ogTitle: t("ogTitle", 200),
    ogDescription: t("ogDescription", 400),
    ogImageId: uuidOrNull(str(form.seo_ogImageId)),
    ...(existing?.legacy ? { legacy: existing.legacy } : {}),
  };
}

/** Normalises a slug from the form, falling back to the title. */
export function cleanSlug(raw: unknown, fallback: string): string {
  return slugify(str(raw) || fallback);
}

/**
 * Posts, legal documents and CMS pages share the root URL namespace /{slug}/.
 * Returns an error message if `slug` is reserved or used by another record.
 */
export async function rootSlugConflict(slug: string, self: { type: "post" | "document" | "page"; id?: string | null }, db?: DbOrTx): Promise<string | null> {
  if (!slug) return "Enter a URL slug.";
  if (RESERVED_SLUGS.has(slug)) return `“${slug}” is reserved by the website. Choose another slug.`;
  const conn = db ?? (await getDb());
  const skip = (type: string) => self.type === type && self.id ? self.id : null;
  const [p] = await conn.select({ id: posts.id }).from(posts).where(and(eq(posts.slug, slug), skip("post") ? ne(posts.id, skip("post")!) : undefined)).limit(1);
  if (p) return `The URL /${slug}/ is already used by a blog post.`;
  const [d] = await conn.select({ id: documents.id }).from(documents).where(and(eq(documents.slug, slug), skip("document") ? ne(documents.id, skip("document")!) : undefined)).limit(1);
  if (d) return `The URL /${slug}/ is already used by a legal document page.`;
  const [g] = await conn.select({ id: pages.id }).from(pages).where(and(eq(pages.path, slug), skip("page") ? ne(pages.id, skip("page")!) : undefined)).limit(1);
  if (g) return `The URL /${slug}/ is already used by a page.`;
  return null;
}

/** Permanent redirect from an old public path to its new one (replacing any older rule for that path). */
export async function addSlugRedirect(oldPath: string, newPath: string, db?: DbOrTx): Promise<void> {
  if (oldPath === newPath) return;
  const conn = db ?? (await getDb());
  await conn
    .insert(redirects)
    .values({ source: oldPath, destination: newPath, statusCode: 301, note: "Created automatically when the URL changed" })
    .onConflictDoUpdate({ target: redirects.source, set: { destination: newPath, statusCode: 301 } });
  // Avoid chains: anything that pointed at the old path now points at the new one.
  await conn.update(redirects).set({ destination: newPath }).where(eq(redirects.destination, oldPath));
  // A redirect from the new path would now loop.
  await conn.delete(redirects).where(eq(redirects.source, newPath));
}

/** Stored HTML keeps uploads root-relative ("/wp-content/uploads/…"); see resolveMediaInHtml. */
export function normaliseMediaHtml(html: string): string {
  const bases = ["https://lexpraxisng.com", "http://lexpraxisng.com", "https://www.lexpraxisng.com", mediaBaseUrl()].filter((b) => b && b !== "/media");
  let out = html;
  for (const base of new Set(bases)) {
    const esc = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(src|href)="${esc}/wp-content/uploads/`, "g"), '$1="/wp-content/uploads/');
  }
  return out.replace(/(src|href)="\/media\/wp-content\/uploads\//g, '$1="/wp-content/uploads/');
}

/** Parses a JSON hidden input, returning `fallback` when missing or malformed. */
export function jsonField<T>(v: unknown, fallback: T): T {
  try {
    const s = str(v);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lines(v: unknown, max = 30): string[] {
  return str(v)
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((x) => x.slice(0, 300));
}

export { str as formString };

/** Media rows → picker values for editor forms. */
export async function pickedMedia(ids: (string | null | undefined)[]): Promise<Map<string, { id: string; url: string; alt: string; width: number | null; height: number | null }>> {
  const wanted = [...new Set(ids.filter(isUuid))];
  if (!wanted.length) return new Map();
  const { media } = await import("@/db/schema");
  const { inArray } = await import("drizzle-orm");
  const db = await getDb();
  const rows = await db.select({ id: media.id, key: media.key, alt: media.alt, width: media.width, height: media.height }).from(media).where(inArray(media.id, wanted));
  return new Map(rows.map((r) => [r.id, { id: r.id, url: `${mediaBaseUrl()}/${r.key}`, alt: r.alt, width: r.width, height: r.height }]));
}
