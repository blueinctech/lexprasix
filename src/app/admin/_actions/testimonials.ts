"use server";

import { asc, desc, eq, gt, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { testimonials } from "@/db/schema";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { uuidOrNull } from "@/lib/admin/editing";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";

// Testimonials are client statements published by the firm: they must be real,
// approved by the client, and attributed (see docs/ACCEPTANCE_CRITERIA.md D5).

const schema = z.object({
  name: z.string().trim().min(1, { error: "Enter the client's name" }).max(120),
  role: z.string().trim().max(120).default(""),
  quote: z.string().trim().min(10, { error: "Enter the testimonial" }).max(2000),
  source: z.enum(["website", "google", "linkedin", "email", "other"]).default("website"),
  sourceUrl: z.union([z.literal(""), z.url({ protocol: /^https$/ })]).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function saveTestimonial(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("pages.manage", async (user) => {
    const form = formObject(fd);
    const parsed = schema.safeParse({ ...form, sourceUrl: form.sourceUrl ?? "" });
    if (!parsed.success) return invalid(parsed.error);
    const id = uuidOrNull(form.id);
    const db = await getDb();
    const values = { ...parsed.data, featured: form.featured === "on" };
    let tid = id;
    if (id) {
      const [row] = await db.update(testimonials).set(values).where(eq(testimonials.id, id)).returning({ id: testimonials.id });
      if (!row) return fail("Not found.");
    } else {
      const [last] = await db.select({ n: testimonials.sortOrder }).from(testimonials).orderBy(desc(testimonials.sortOrder)).limit(1);
      const [row] = await db.insert(testimonials).values({ ...values, sortOrder: (last?.n ?? 0) + 1 }).returning({ id: testimonials.id });
      tid = row.id;
    }
    await audit({ userId: user.id, action: id ? "testimonial.update" : "testimonial.create", entityType: "testimonial", entityId: tid!, details: { name: values.name, status: values.status } });
    refreshPublic("testimonials");
    if (!id) redirect(`/admin/testimonials/${tid}/?created=1`);
    return ok("Saved.");
  });
}

export async function moveTestimonial(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("pages.manage", async () => {
    const id = uuidOrNull(fd.get("id"));
    const up = fd.get("dir") === "up";
    const db = await getDb();
    const [row] = id ? await db.select({ id: testimonials.id, n: testimonials.sortOrder }).from(testimonials).where(eq(testimonials.id, id)) : [];
    if (!row) return fail("Not found.");
    const [other] = await db
      .select({ id: testimonials.id, n: testimonials.sortOrder })
      .from(testimonials)
      .where(up ? lt(testimonials.sortOrder, row.n) : gt(testimonials.sortOrder, row.n))
      .orderBy(up ? desc(testimonials.sortOrder) : asc(testimonials.sortOrder))
      .limit(1);
    if (other) {
      await db.update(testimonials).set({ sortOrder: other.n }).where(eq(testimonials.id, row.id));
      await db.update(testimonials).set({ sortOrder: row.n }).where(eq(testimonials.id, other.id));
      refreshPublic("testimonials");
    }
    return { status: "ok" };
  });
}

export async function deleteTestimonial(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("pages.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const db = await getDb();
    const [row] = id ? await db.delete(testimonials).where(eq(testimonials.id, id)).returning() : [];
    if (!row) return fail("Not found.");
    await audit({ userId: user.id, action: "testimonial.delete", entityType: "testimonial", entityId: row.id, details: { name: row.name } });
    refreshPublic("testimonials");
    redirect("/admin/testimonials/?deleted=1");
  });
}
