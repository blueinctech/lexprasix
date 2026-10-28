import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents, services } from "@/db/schema";
import { pickedMedia, toLagosInput } from "@/lib/admin/editing";
import { resolveMediaInHtml } from "@/lib/content/queries";
import type { ServiceEditorData } from "@/components/admin/ServiceEditor";

export async function serviceOptions(selfId: string | null) {
  const db = await getDb();
  const [s, d] = await Promise.all([
    db.select({ id: services.id, title: services.title }).from(services).orderBy(asc(services.sortOrder)),
    db.select({ id: documents.id, title: documents.title }).from(documents).orderBy(asc(documents.sortOrder)),
  ]);
  return { otherServices: s.filter((x) => x.id !== selfId), documents: d };
}

export async function loadService(id: string): Promise<ServiceEditorData | null> {
  const db = await getDb();
  const [row] = await db.select().from(services).where(eq(services.id, id));
  if (!row) return null;
  const media = await pickedMedia([row.featuredImageId, row.seo.ogImageId]);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortTitle: row.shortTitle,
    summary: row.summary,
    body: resolveMediaInHtml(row.body),
    audience: row.audience,
    process: row.process,
    faqs: row.faqs,
    relatedServiceIds: row.relatedServiceIds,
    relatedDocumentIds: row.relatedDocumentIds,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    icon: row.icon,
    status: row.status,
    publishedAtInput: toLagosInput(row.publishedAt),
    featuredImage: media.get(row.featuredImageId ?? "") ?? null,
    ogImage: media.get(row.seo.ogImageId ?? "") ?? null,
    seo: row.seo,
  };
}
