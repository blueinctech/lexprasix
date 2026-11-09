"use server";

import { asc, desc, eq, gt, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { addSlugRedirect, cleanSlug, formString, normaliseMediaHtml, parseSeo, parseStatus, uuidOrNull } from "@/lib/admin/editing";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { sanitizeRichHtml } from "@/lib/sanitize";

// Shop products (Admin → Shop). Same permission as services: editors and administrators.

const schema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title" }).max(200),
  summary: z.string().trim().max(600).default(""),
  priceLabel: z.string().trim().max(60).default(""),
  priceAmount: z
    .string()
    .trim()
    .max(20)
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), { error: "Enter a number like 5000 or 5000.00, or leave empty" })
    .default(""),
  priceCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v || "NGN")
    .refine((v) => /^[A-Z]{3}$/.test(v), { error: "Use a 3-letter currency code, e.g. NGN or USD" })
    .default("NGN"),
  format: z.string().trim().max(80).default(""),
  buyUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(v), { error: "Use a full https:// link to the payment page, or leave empty" })
    .default(""),
  buyLabel: z.string().trim().max(40).default(""),
});

export async function saveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("services.manage", async (user) => {
    const form = formObject(fd);
    const id = uuidOrNull(form.id);
    const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((k) => [k, formString(form[k])])));
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [prev] = id ? await db.select().from(products).where(eq(products.id, id)) : [];
    if (id && !prev) return fail("This product no longer exists.");
    const slug = cleanSlug(form.slug, parsed.data.title);
    if (!slug) return fail("Enter a URL slug.", { slug: "Enter a URL slug." });
    const [clash] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
    if (clash && clash.id !== id) return fail(`/product/${slug}/ is already used by another product.`, { slug: "Already in use" });
    const st = parseStatus(form, { canPublish: true, existing: prev ?? undefined });
    if (!st.ok) return fail(st.error);

    const values = {
      ...parsed.data,
      buyLabel: parsed.data.buyLabel || "Buy now",
      slug,
      body: normaliseMediaHtml(sanitizeRichHtml(formString(form.body))),
      featuredImageId: uuidOrNull(form.featuredImageId),
      status: st.status,
      publishedAt: st.publishedAt,
      seo: parseSeo(form, prev?.seo),
      updatedById: user.id,
    };
    const productId = await db.transaction(async (tx) => {
      if (prev) {
        await tx.update(products).set(values).where(eq(products.id, prev.id));
        if (prev.slug !== slug && prev.status === "published") await addSlugRedirect(`/product/${prev.slug}/`, `/product/${slug}/`, tx);
        return prev.id;
      }
      const [last] = await tx.select({ n: products.sortOrder }).from(products).orderBy(desc(products.sortOrder)).limit(1);
      const [row] = await tx.insert(products).values({ ...values, sortOrder: (last?.n ?? 0) + 1 }).returning({ id: products.id });
      return row.id;
    });
    const action = !prev ? "product.create" : prev.status !== "published" && st.status === "published" ? "product.publish" : prev.status === "published" && st.status !== "published" ? "product.unpublish" : "product.update";
    await audit({
      userId: user.id,
      action,
      entityType: "product",
      entityId: productId,
      details: { title: values.title, slug, ...(prev && prev.buyUrl !== values.buyUrl ? { buyUrlChanged: true } : {}), ...(prev && prev.priceLabel !== values.priceLabel ? { price: values.priceLabel } : {}) },
    });
    refreshPublic("products", `product:${slug}`, ...(prev && prev.slug !== slug ? [`product:${prev.slug}`, "redirects"] : []));
    if (!prev) redirect(`/admin/products/${productId}/?created=1`);
    return ok(st.status === "published" ? "Saved and live on the website." : "Saved.");
  });
}

export async function moveProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("services.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const dir = fd.get("dir") === "up" ? "up" : "down";
    const db = await getDb();
    const [row] = id ? await db.select({ id: products.id, sortOrder: products.sortOrder }).from(products).where(eq(products.id, id)) : [];
    if (!row) return fail("Product not found.");
    const [other] = await db
      .select({ id: products.id, sortOrder: products.sortOrder })
      .from(products)
      .where(dir === "up" ? lt(products.sortOrder, row.sortOrder) : gt(products.sortOrder, row.sortOrder))
      .orderBy(dir === "up" ? desc(products.sortOrder) : asc(products.sortOrder))
      .limit(1);
    if (!other) return { status: "ok" };
    await db.transaction(async (tx) => {
      await tx.update(products).set({ sortOrder: other.sortOrder }).where(eq(products.id, row.id));
      await tx.update(products).set({ sortOrder: row.sortOrder }).where(eq(products.id, other.id));
    });
    await audit({ userId: user.id, action: "product.reorder", entityType: "product", entityId: row.id, details: { dir } });
    refreshPublic("products");
    return { status: "ok" };
  });
}

export async function deleteProduct(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("services.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const db = await getDb();
    const [row] = id ? await db.select().from(products).where(eq(products.id, id)) : [];
    if (!row) return fail("This product no longer exists.");
    await db.delete(products).where(eq(products.id, row.id));
    await audit({ userId: user.id, action: "product.delete", entityType: "product", entityId: row.id, details: { title: row.title, slug: row.slug } });
    refreshPublic("products", `product:${row.slug}`);
    redirect("/admin/products/?deleted=1");
  });
}
