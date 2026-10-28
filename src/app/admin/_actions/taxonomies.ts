"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, postCategories, postTags, tags } from "@/db/schema";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { addSlugRedirect, cleanSlug, parseSeo, uuidOrNull } from "@/lib/admin/editing";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";

const schema = z.object({
  kind: z.enum(["category", "tag"]),
  name: z.string().trim().min(1, { error: "Enter a name" }).max(80),
  description: z.string().trim().max(1000).default(""),
});

const tables = { category: categories, tag: tags } as const;

export async function saveTerm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("taxonomies.manage", async (user) => {
    const form = formObject(fd);
    const parsed = schema.safeParse({ kind: form.kind, name: form.name, description: form.description ?? "" });
    if (!parsed.success) return invalid(parsed.error);
    const { kind, name, description } = parsed.data;
    const table = tables[kind] as typeof categories;
    const id = uuidOrNull(form.id);
    const slug = cleanSlug(form.slug, name);
    if (!slug) return fail("Enter a slug.", { slug: "Enter a slug." });
    const db = await getDb();
    const [prev] = id ? await db.select().from(table).where(eq(table.id, id)) : [];
    if (id && !prev) return fail("Not found.");
    const [clash] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug));
    if (clash && clash.id !== id) return fail(`Another ${kind} already uses /${kind}/${slug}/.`, { slug: "Already in use" });
    const values = { name, slug, description, seo: parseSeo(form, prev?.seo) };
    if (prev) {
      await db.update(table).set(values).where(eq(table.id, prev.id));
      if (prev.slug !== slug) await addSlugRedirect(`/${kind}/${prev.slug}/`, `/${kind}/${slug}/`);
    } else {
      await db.insert(table).values(values);
    }
    await audit({ userId: user.id, action: prev ? `${kind}.update` : `${kind}.create`, entityType: kind, entityId: prev?.id, details: { name, slug } });
    refreshPublic("taxonomies", "posts", ...(prev && prev.slug !== slug ? ["redirects"] : []));
    if (!prev) return ok(`${kind === "category" ? "Category" : "Tag"} “${name}” created.`);
    return ok("Saved.");
  });
}

export async function deleteTerm(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("taxonomies.manage", async (user) => {
    const kind = fd.get("kind") === "tag" ? "tag" : "category";
    const id = uuidOrNull(fd.get("id"));
    const table = tables[kind] as typeof categories;
    const db = await getDb();
    const [row] = id ? await db.select().from(table).where(eq(table.id, id)) : [];
    if (!row) return fail("Not found.");
    const [{ n }] =
      kind === "category"
        ? await db.select({ n: count() }).from(postCategories).where(eq(postCategories.categoryId, row.id))
        : await db.select({ n: count() }).from(postTags).where(eq(postTags.tagId, row.id));
    if (n > 0 && fd.get("confirmUsed") !== "on") return fail(`This ${kind} is used by ${n} article(s). Tick the box to confirm removing it from them.`);
    await db.delete(table).where(eq(table.id, row.id));
    // The archive URL had backlinks: send it to the blog rather than a 404.
    if (n > 0) await addSlugRedirect(`/${kind}/${row.slug}/`, "/blog/");
    await audit({ userId: user.id, action: `${kind}.delete`, entityType: kind, entityId: row.id, details: { name: row.name, slug: row.slug, posts: n } });
    refreshPublic("taxonomies", "posts", "redirects");
    redirect(`/admin/taxonomies/?kind=${kind}&deleted=1`);
  });
}
