import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { allForms } from "@/forms/registry";
import { pickedMedia, toLagosInput } from "@/lib/admin/editing";
import { resolveMediaInHtml } from "@/lib/content/queries";
import type { DocumentEditorData } from "@/components/admin/DocumentEditor";

export function documentForms() {
  return allForms()
    .filter((f) => f.kind === "document")
    .map((f) => ({ value: f.id, label: f.title }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function loadDocument(id: string): Promise<DocumentEditorData | null> {
  const db = await getDb();
  const [row] = await db.select().from(documents).where(eq(documents.id, id));
  if (!row) return null;
  const media = await pickedMedia([row.featuredImageId, row.seo.ogImageId]);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    group: row.group,
    summary: row.summary,
    body: resolveMediaInHtml(row.body),
    deliverables: row.deliverables,
    requirements: row.requirements,
    faqs: row.faqs,
    formId: row.formId,
    sortOrder: row.sortOrder,
    status: row.status,
    publishedAtInput: toLagosInput(row.publishedAt),
    featuredImage: media.get(row.featuredImageId ?? "") ?? null,
    ogImage: media.get(row.seo.ogImageId ?? "") ?? null,
    seo: row.seo,
  };
}
