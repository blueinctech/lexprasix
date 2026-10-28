"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { categories, postCategories, posts, postTags, tags } from "@/db/schema";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic, slugify } from "@/lib/admin/content";
import { addSlugRedirect, cleanSlug, formString, normaliseMediaHtml, parseSeo, parseStatus, rootSlugConflict, uuidOrNull } from "@/lib/admin/editing";
import { saveRevision } from "@/lib/admin/revisions";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";
import { plainText, readingMinutes, sanitizeRichHtml } from "@/lib/sanitize";

const schema = z.object({
  title: z.string().trim().min(1, { error: "Enter a title" }).max(200),
  excerpt: z.string().trim().max(600).default(""),
  html: z.string().max(500_000),
});

/** Loads a post the user may edit, or explains why not. */
async function editable(user: CurrentUser, id: string) {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  if (!row) return { error: "This article no longer exists." } as const;
  if (!can(user.role, "posts.edit_any")) {
    if (!user.authorId || row.authorId !== user.authorId) return { error: "You can only edit your own articles." } as const;
    if (row.status !== "draft") return { error: "This article is live or scheduled. Ask an editor to change it." } as const;
  }
  return { row } as const;
}

async function tagIdsFrom(input: string): Promise<string[]> {
  const names = [...new Set(input.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  if (!names.length) return [];
  const db = await getDb();
  const wanted = names.map((name) => ({ name: name.slice(0, 80), slug: slugify(name) })).filter((t) => t.slug);
  await db.insert(tags).values(wanted).onConflictDoNothing({ target: tags.slug });
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.slug, wanted.map((t) => t.slug)));
  return rows.map((r) => r.id);
}

export async function savePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("posts.edit_own", async (user) => {
    const form = formObject(fd);
    const id = uuidOrNull(form.id);
    const parsed = schema.safeParse({ title: form.title, excerpt: form.excerpt ?? "", html: form.html ?? "" });
    if (!parsed.success) return invalid(parsed.error);
    const existing = id ? await editable(user, id) : null;
    if (existing && "error" in existing) return fail(existing.error!);
    const prev = existing?.row ?? null;

    const canPublish = can(user.role, "posts.publish");
    const st = parseStatus(form, { canPublish, existing: prev ?? undefined });
    if (!st.ok) return fail(st.error, { status: st.error });

    const slug = cleanSlug(form.slug, parsed.data.title);
    const conflict = await rootSlugConflict(slug, { type: "post", id });
    if (conflict) return fail(conflict, { slug: conflict });

    let authorId = uuidOrNull(form.authorId);
    if (!can(user.role, "posts.edit_any")) {
      if (!user.authorId) return fail("Your account isn't linked to an author profile. Ask an administrator to link it.");
      authorId = user.authorId;
    }

    const html = normaliseMediaHtml(sanitizeRichHtml(parsed.data.html));
    const excerpt = parsed.data.excerpt || plainText(html).slice(0, 280);
    const bodyChanged = !prev || prev.html !== html;
    const now = new Date();
    const values = {
      title: parsed.data.title,
      slug,
      excerpt,
      html,
      authorId,
      featuredImageId: uuidOrNull(form.featuredImageId),
      status: st.status,
      publishedAt: st.publishedAt,
      // Readers see "Updated" when the body of a live article changes.
      contentUpdatedAt: prev?.status === "published" && bodyChanged ? now : (prev?.contentUpdatedAt ?? st.publishedAt),
      readingMinutes: readingMinutes(html),
      seo: parseSeo(form, prev?.seo),
      updatedById: user.id,
    };
    const categoryIds = (Array.isArray(form.categoryIds) ? form.categoryIds : form.categoryIds ? [form.categoryIds] : []).filter((x) => uuidOrNull(x));
    const tagIds = await tagIdsFrom(formString(form.tags));

    const db = await getDb();
    const postId = await db.transaction(async (tx) => {
      let pid = id;
      if (prev) {
        const [cats, tgs] = await Promise.all([
          tx.select({ id: postCategories.categoryId }).from(postCategories).where(eq(postCategories.postId, prev.id)),
          tx.select({ id: postTags.tagId }).from(postTags).where(eq(postTags.postId, prev.id)),
        ]);
        await saveRevision("post", prev.id, { ...prev, categoryIds: cats.map((c) => c.id), tagIds: tgs.map((t) => t.id) }, user.id, tx);
        await tx.update(posts).set(values).where(eq(posts.id, prev.id));
      } else {
        const [row] = await tx.insert(posts).values(values).returning({ id: posts.id });
        pid = row.id;
      }
      await tx.delete(postCategories).where(eq(postCategories.postId, pid!));
      await tx.delete(postTags).where(eq(postTags.postId, pid!));
      if (categoryIds.length) {
        const valid = await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, categoryIds));
        if (valid.length) await tx.insert(postCategories).values(valid.map((c) => ({ postId: pid!, categoryId: c.id })));
      }
      if (tagIds.length) await tx.insert(postTags).values(tagIds.map((t) => ({ postId: pid!, tagId: t })));
      if (prev && prev.slug !== slug && prev.status === "published") await addSlugRedirect(`/${prev.slug}/`, `/${slug}/`, tx);
      return pid!;
    });

    const wasLive = prev?.status === "published";
    const isLive = st.status === "published";
    const action = !prev ? "post.create" : !wasLive && isLive ? "post.publish" : wasLive && !isLive ? "post.unpublish" : "post.update";
    await audit({ userId: user.id, action, entityType: "post", entityId: postId, details: { title: values.title, slug, status: st.status } });
    refreshPublic("posts", "taxonomies", "authors", `post:${slug}`, ...(prev && prev.slug !== slug ? [`post:${prev.slug}`, "redirects"] : []));

    if (!prev) redirect(`/admin/posts/${postId}/?created=1`);
    return ok(st.status === "published" ? "Saved and live on the website." : st.status === "scheduled" ? "Saved. It will publish automatically at the scheduled time." : "Draft saved.");
  });
}

export async function deletePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("posts.delete", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    if (!id) return fail("Missing article.");
    const db = await getDb();
    const [row] = await db.select().from(posts).where(eq(posts.id, id));
    if (!row) return fail("This article no longer exists.");
    await saveRevision("post", row.id, { ...row, deleted: true }, user.id);
    await db.delete(posts).where(and(eq(posts.id, id)));
    await audit({ userId: user.id, action: "post.delete", entityType: "post", entityId: id, details: { title: row.title, slug: row.slug, status: row.status } });
    refreshPublic("posts", "taxonomies", "authors", `post:${row.slug}`);
    redirect("/admin/posts/?deleted=1");
  });
}
