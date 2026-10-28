import "server-only";
import { asc, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { authors, categories, comments, postCategories, posts, postTags, tags } from "@/db/schema";
import { pickedMedia, toLagosInput } from "@/lib/admin/editing";
import { resolveMediaInHtml } from "@/lib/content/queries";
import type { PostEditorData } from "@/components/admin/PostEditor";

export async function editorOptions() {
  const db = await getDb();
  const [a, c] = await Promise.all([
    db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
  ]);
  return { authors: a, categories: c };
}

export async function loadPost(id: string): Promise<{ data: PostEditorData; authorId: string | null; status: string } | null> {
  const db = await getDb();
  const [row] = await db.select().from(posts).where(eq(posts.id, id));
  if (!row) return null;
  const [cats, tagRows, [{ n }], media] = await Promise.all([
    db.select({ id: postCategories.categoryId }).from(postCategories).where(eq(postCategories.postId, id)),
    db.select({ name: tags.name }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(postTags.postId, id)),
    db.select({ n: count() }).from(comments).where(eq(comments.postId, id)),
    pickedMedia([row.featuredImageId, row.seo.ogImageId]),
  ]);
  return {
    authorId: row.authorId,
    status: row.status,
    data: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      // The editor shows images from the media host; saving makes them root-relative again.
      html: resolveMediaInHtml(row.html),
      status: row.status,
      publishedAtInput: toLagosInput(row.publishedAt),
      authorId: row.authorId,
      featuredImage: media.get(row.featuredImageId ?? "") ?? null,
      ogImage: media.get(row.seo.ogImageId ?? "") ?? null,
      seo: row.seo,
      categoryIds: cats.map((c) => c.id),
      tags: tagRows.map((t) => t.name).join(", "),
      readingMinutes: row.readingMinutes,
      comments: n,
    },
  };
}
