"use server";

import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { getFormDefinition } from "@/forms/registry";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { addSlugRedirect, cleanSlug, formString, jsonField, lines, normaliseMediaHtml, parseSeo, parseStatus, rootSlugConflict, uuidOrNull } from "@/lib/admin/editing";
import { saveRevision } from "@/lib/admin/revisions";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { sanitizeRichHtml } from "@/lib/sanitize";

const schema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title" }).max(200),
  group: z.enum(["corporate-filings", "agreements"], { error: "Choose a group" }),
  summary: z.string().trim().max(600).default(""),
  formId: z.string().refine((v) => getFormDefinition(v)?.kind === "document", { error: "Choose the questionnaire for this page" }),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const faqSchema = z.array(z.object({ question: z.string().trim().max(300), answer: z.string().trim().max(3000) })).max(30);

export async function saveDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("documents.manage", async (user) => {
    const form = formObject(fd);
    const id = uuidOrNull(form.id);
    const parsed = schema.safeParse({ title: form.title, group: form.group, summary: form.summary ?? "", formId: form.formId, sortOrder: form.sortOrder || 0 });
    if (!parsed.success) return invalid(parsed.error);
    const faqs = faqSchema.safeParse(jsonField(form.faqs, []));
    if (!faqs.success) return fail("Check the FAQs.");
    const db = await getDb();
    const [prev] = id ? await db.select().from(documents).where(eq(documents.id, id)) : [];
    if (id && !prev) return fail("This page no longer exists.");
    const slug = cleanSlug(form.slug, parsed.data.title);
    const conflict = await rootSlugConflict(slug, { type: "document", id });
    if (conflict) return fail(conflict, { slug: conflict });
    const st = parseStatus(form, { canPublish: true, existing: prev ?? undefined });
    if (!st.ok) return fail(st.error);

    const values = {
      ...parsed.data,
      slug,
      body: normaliseMediaHtml(sanitizeRichHtml(formString(form.body))),
      deliverables: lines(form.deliverables),
      requirements: lines(form.requirements),
      faqs: faqs.data.filter((f) => f.question && f.answer),
      featuredImageId: uuidOrNull(form.featuredImageId),
      status: st.status,
      publishedAt: st.publishedAt,
      seo: parseSeo(form, prev?.seo),
      updatedById: user.id,
    };
    const docId = await db.transaction(async (tx) => {
      if (prev) {
        await saveRevision("document", prev.id, prev as unknown as Record<string, unknown>, user.id, tx);
        await tx.update(documents).set(values).where(eq(documents.id, prev.id));
        if (prev.slug !== slug && prev.status === "published") await addSlugRedirect(`/${prev.slug}/`, `/${slug}/`, tx);
        return prev.id;
      }
      const [last] = await tx.select({ n: documents.sortOrder }).from(documents).orderBy(desc(documents.sortOrder)).limit(1);
      const [row] = await tx.insert(documents).values({ ...values, sortOrder: values.sortOrder || (last?.n ?? 0) + 1 }).returning({ id: documents.id });
      return row.id;
    });
    const action = !prev ? "document.create" : prev.status !== "published" && st.status === "published" ? "document.publish" : prev.status === "published" && st.status !== "published" ? "document.unpublish" : "document.update";
    await audit({ userId: user.id, action, entityType: "document", entityId: docId, details: { title: values.title, slug } });
    refreshPublic("documents", "posts", "pages", `document:${slug}`, ...(prev && prev.slug !== slug ? [`document:${prev.slug}`, "redirects"] : []));
    if (!prev) redirect(`/admin/documents/${docId}/?created=1`);
    return ok(st.status === "published" ? "Saved and live on the website." : "Saved.");
  });
}

export async function deleteDocument(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("documents.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const db = await getDb();
    const [row] = id ? await db.select().from(documents).where(eq(documents.id, id)) : [];
    if (!row) return fail("This page no longer exists.");
    await saveRevision("document", row.id, { ...row, deleted: true } as unknown as Record<string, unknown>, user.id);
    await db.delete(documents).where(eq(documents.id, row.id));
    await audit({ userId: user.id, action: "document.delete", entityType: "document", entityId: row.id, details: { title: row.title, slug: row.slug } });
    refreshPublic("documents", "posts", `document:${row.slug}`);
    redirect("/admin/documents/?deleted=1");
  });
}
