"use server";

import { and, asc, eq, gt, lt, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { services } from "@/db/schema";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { addSlugRedirect, cleanSlug, formString, jsonField, normaliseMediaHtml, parseSeo, parseStatus, uuidOrNull } from "@/lib/admin/editing";
import { saveRevision } from "@/lib/admin/revisions";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { sanitizeRichHtml } from "@/lib/sanitize";

const pair = (a: string, b: string) => z.array(z.object({ [a]: z.string().trim().max(3000), [b]: z.string().trim().max(3000) })).max(30);

const schema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title" }).max(200),
  shortTitle: z.string().trim().max(80).default(""),
  summary: z.string().trim().max(600).default(""),
  audience: z.string().trim().max(1000).default(""),
  ctaLabel: z.string().trim().max(60).default(""),
  ctaHref: z.string().trim().max(300).refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), { error: "Use a site path like /contact-us/ or an https:// link" }).default(""),
  icon: z.string().trim().max(40).default(""),
});

export async function saveService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("services.manage", async (user) => {
    const form = formObject(fd);
    const id = uuidOrNull(form.id);
    const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, formString(form[k])])));
    if (!parsed.success) return invalid(parsed.error);
    const process = pair("title", "text").safeParse(jsonField(form.process, []));
    const faqs = pair("question", "answer").safeParse(jsonField(form.faqs, []));
    if (!process.success || !faqs.success) return fail("Check the process steps and FAQs.");
    const db = await getDb();
    const [prev] = id ? await db.select().from(services).where(eq(services.id, id)) : [];
    if (id && !prev) return fail("This service no longer exists.");
    const slug = cleanSlug(form.slug, parsed.data.title);
    if (!slug) return fail("Enter a URL slug.", { slug: "Enter a URL slug." });
    const [clash] = await db.select({ id: services.id }).from(services).where(eq(services.slug, slug));
    if (clash && clash.id !== id) return fail(`/service/${slug}/ is already used by another service.`, { slug: "Already in use" });
    const st = parseStatus(form, { canPublish: true, existing: prev ?? undefined });
    if (!st.ok) return fail(st.error);
    const ids = (k: string) => (Array.isArray(form[k]) ? (form[k] as string[]) : form[k] ? [form[k] as string] : []).map(uuidOrNull).filter((x): x is string => Boolean(x) && x !== id);

    const values = {
      ...parsed.data,
      slug,
      body: normaliseMediaHtml(sanitizeRichHtml(formString(form.body))),
      process: process.data.filter((p) => p.title || p.text) as { title: string; text: string }[],
      faqs: faqs.data.filter((f) => f.question && f.answer) as { question: string; answer: string }[],
      relatedServiceIds: ids("relatedServiceIds"),
      relatedDocumentIds: ids("relatedDocumentIds"),
      featuredImageId: uuidOrNull(form.featuredImageId),
      status: st.status,
      publishedAt: st.publishedAt,
      seo: parseSeo(form, prev?.seo),
      updatedById: user.id,
    };
    const serviceId = await db.transaction(async (tx) => {
      if (prev) {
        await saveRevision("service", prev.id, prev as unknown as Record<string, unknown>, user.id, tx);
        await tx.update(services).set(values).where(eq(services.id, prev.id));
        if (prev.slug !== slug && prev.status === "published") await addSlugRedirect(`/service/${prev.slug}/`, `/service/${slug}/`, tx);
        return prev.id;
      }
      const [last] = await tx.select({ n: services.sortOrder }).from(services).orderBy(desc(services.sortOrder)).limit(1);
      const [row] = await tx.insert(services).values({ ...values, sortOrder: (last?.n ?? 0) + 1 }).returning({ id: services.id });
      return row.id;
    });
    const action = !prev ? "service.create" : prev.status !== "published" && st.status === "published" ? "service.publish" : prev.status === "published" && st.status !== "published" ? "service.unpublish" : "service.update";
    await audit({ userId: user.id, action, entityType: "service", entityId: serviceId, details: { title: values.title, slug } });
    refreshPublic("services", `service:${slug}`, ...(prev && prev.slug !== slug ? [`service:${prev.slug}`, "redirects"] : []));
    if (!prev) redirect(`/admin/services/${serviceId}/?created=1`);
    return ok(st.status === "published" ? "Saved and live on the website." : "Saved.");
  });
}

export async function moveService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("services.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const dir = fd.get("dir") === "up" ? "up" : "down";
    const db = await getDb();
    const [row] = id ? await db.select({ id: services.id, sortOrder: services.sortOrder }).from(services).where(eq(services.id, id)) : [];
    if (!row) return fail("Service not found.");
    const [other] = await db
      .select({ id: services.id, sortOrder: services.sortOrder })
      .from(services)
      .where(dir === "up" ? lt(services.sortOrder, row.sortOrder) : gt(services.sortOrder, row.sortOrder))
      .orderBy(dir === "up" ? desc(services.sortOrder) : asc(services.sortOrder))
      .limit(1);
    if (!other) return { status: "ok" };
    await db.transaction(async (tx) => {
      await tx.update(services).set({ sortOrder: other.sortOrder }).where(eq(services.id, row.id));
      await tx.update(services).set({ sortOrder: row.sortOrder }).where(and(eq(services.id, other.id)));
    });
    await audit({ userId: user.id, action: "service.reorder", entityType: "service", entityId: row.id, details: { dir } });
    refreshPublic("services");
    return { status: "ok" };
  });
}

export async function deleteService(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("services.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const db = await getDb();
    const [row] = id ? await db.select().from(services).where(eq(services.id, id)) : [];
    if (!row) return fail("This service no longer exists.");
    await saveRevision("service", row.id, { ...row, deleted: true } as unknown as Record<string, unknown>, user.id);
    await db.delete(services).where(eq(services.id, row.id));
    await audit({ userId: user.id, action: "service.delete", entityType: "service", entityId: row.id, details: { title: row.title, slug: row.slug } });
    refreshPublic("services", `service:${row.slug}`);
    redirect("/admin/services/?deleted=1");
  });
}
