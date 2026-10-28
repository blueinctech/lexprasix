"use server";

import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { redirects } from "@/db/schema";
import { adminAction, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";

// Redirects are matched by the public catch-all route against the request path,
// lower-cased and with a trailing slash; sources are normalised the same way.

const SITE = /^https?:\/\/(www\.)?lexpraxisng\.com/i;

function normaliseSource(input: string): string | null {
  let v = input.trim().replace(SITE, "");
  if (!v.startsWith("/")) v = `/${v}`;
  if (/[?#\s]/.test(v) || v.includes("//") || v.length > 300) return null;
  v = v.toLowerCase().replace(/\/+$/, "");
  return `${v}/`;
}

function normaliseDestination(input: string): string | null {
  const v = input.trim().replace(SITE, "") || "/";
  if (/^https:\/\/[^\s]+$/i.test(v)) return v;
  if (!v.startsWith("/") || v.startsWith("//") || /\s/.test(v) || v.length > 500) return null;
  const [path, rest = ""] = v.split(/(?=[?#])/);
  return `${path.endsWith("/") || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`}${rest}`;
}

const codes = z.coerce.number().refine((n) => [301, 302, 307, 308].includes(n), { error: "Choose 301, 302, 307 or 308" });

type Prepared = { source: string; destination: string; statusCode: number; note: string };

/** Validates one redirect and follows chains so every redirect is a single hop. */
async function prepare(input: { source: string; destination: string; statusCode: number; note?: string }, selfId?: string): Promise<{ ok: true; value: Prepared; repointed: number } | { ok: false; message: string; field?: string }> {
  const source = normaliseSource(input.source);
  if (!source) return { ok: false, message: "The old URL must be a path on this site, like /old-page/ (no query strings).", field: "source" };
  if (source === "/") return { ok: false, message: "The homepage can't be redirected.", field: "source" };
  let destination = normaliseDestination(input.destination);
  if (!destination) return { ok: false, message: "The new URL must start with / or https://", field: "destination" };
  if (destination.toLowerCase() === source) return { ok: false, message: "A page can't redirect to itself.", field: "destination" };

  const db = await getDb();
  // If the destination is itself redirected, point straight at the final target.
  const seen = new Set([source]);
  for (let i = 0; i < 10 && destination.startsWith("/"); i++) {
    const [next] = await db.select({ destination: redirects.destination }).from(redirects).where(eq(redirects.source, destination.toLowerCase().split(/[?#]/)[0]));
    if (!next) break;
    if (seen.has(next.destination.toLowerCase())) return { ok: false, message: "This would create a redirect loop.", field: "destination" };
    seen.add(destination.toLowerCase());
    destination = next.destination;
  }
  if (destination.toLowerCase() === source) return { ok: false, message: "This would create a redirect loop.", field: "destination" };

  // Redirects that currently point at this source would become chains: repoint them.
  const pointing = await db
    .select({ id: redirects.id })
    .from(redirects)
    .where(and(eq(redirects.destination, source), selfId ? ne(redirects.id, selfId) : undefined));
  return { ok: true, value: { source, destination, statusCode: input.statusCode, note: input.note ?? "" }, repointed: pointing.length };
}

async function repoint(source: string, destination: string) {
  const db = await getDb();
  await db.update(redirects).set({ destination }).where(eq(redirects.destination, source));
}

export async function saveRedirect(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("redirects.manage", async (user) => {
    const parsed = z
      .object({ id: z.string().optional(), source: z.string().min(1, { error: "Enter the old URL" }), destination: z.string().min(1, { error: "Enter the new URL" }), statusCode: codes, note: z.string().trim().max(200).optional() })
      .safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const id = parsed.data.id || undefined;
    const prepared = await prepare(parsed.data, id);
    if (!prepared.ok) return fail(prepared.message, prepared.field ? { [prepared.field]: prepared.message } : undefined);
    const db = await getDb();
    const [clash] = await db.select({ id: redirects.id }).from(redirects).where(and(eq(redirects.source, prepared.value.source), id ? ne(redirects.id, id) : undefined));
    if (clash) return fail("A redirect for this old URL already exists.", { source: "Already redirected" });
    if (id) await db.update(redirects).set(prepared.value).where(eq(redirects.id, id));
    else await db.insert(redirects).values(prepared.value);
    if (prepared.repointed) await repoint(prepared.value.source, prepared.value.destination);
    await audit({ userId: user.id, action: id ? "redirect.update" : "redirect.create", entityType: "redirect", entityId: prepared.value.source });
    refreshPublic("redirects");
    const extra = prepared.repointed ? ` ${prepared.repointed} other redirect(s) now point straight to ${prepared.value.destination}.` : "";
    if (id) return ok(`Saved: ${prepared.value.source} → ${prepared.value.destination}.${extra}`);
    return ok(`Added: ${prepared.value.source} → ${prepared.value.destination}.${extra}`);
  });
}

export async function deleteRedirect(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("redirects.manage", async (user) => {
    const id = String(fd.get("id") ?? "");
    const db = await getDb();
    const [row] = await db.delete(redirects).where(eq(redirects.id, id)).returning({ source: redirects.source });
    if (!row) return fail("Redirect not found.");
    await audit({ userId: user.id, action: "redirect.delete", entityType: "redirect", entityId: row.source });
    refreshPublic("redirects");
    redirect("/admin/redirects/?deleted=1");
  });
}

/** Bulk import, one "old,new[,code]" per line. Existing sources are updated. */
export async function importRedirects(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("redirects.manage", async (user) => {
    const text = String(fd.get("csv") ?? "");
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    if (!lines.length) return fail("Paste at least one line.", { csv: "Empty" });
    if (lines.length > 1000) return fail("Import at most 1,000 redirects at a time.", { csv: "Too many lines" });
    const db = await getDb();
    let added = 0;
    let updated = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const [source = "", destination = "", code = "301"] = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      if (i === 0 && /^(old|source)/i.test(source)) continue;
      const status = Number(code) || 301;
      if (![301, 302, 307, 308].includes(status)) {
        errors.push(`Line ${i + 1}: status must be 301, 302, 307 or 308`);
        continue;
      }
      const prepared = await prepare({ source, destination, statusCode: status, note: "Bulk import" });
      if (!prepared.ok) {
        errors.push(`Line ${i + 1}: ${prepared.message}`);
        continue;
      }
      const [existing] = await db.select({ id: redirects.id }).from(redirects).where(eq(redirects.source, prepared.value.source));
      if (existing) {
        await db.update(redirects).set(prepared.value).where(eq(redirects.id, existing.id));
        updated++;
      } else {
        await db.insert(redirects).values(prepared.value);
        added++;
      }
      if (prepared.repointed) await repoint(prepared.value.source, prepared.value.destination);
    }
    await audit({ userId: user.id, action: "redirect.import", entityType: "redirect", details: { added, updated, errors: errors.length } });
    refreshPublic("redirects");
    const summary = `Imported: ${added} added, ${updated} updated${errors.length ? `, ${errors.length} skipped` : ""}.`;
    return errors.length ? fail(`${summary} ${errors.slice(0, 8).join("; ")}${errors.length > 8 ? "…" : ""}`) : ok(summary);
  });
}
