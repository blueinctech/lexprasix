import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import type { ComponentProps } from "react";
import { DocumentView, PageView, PostView, ServiceView } from "@/components/content/views";
import { getDb } from "@/db";
import { authors, categories, comments, documents, pages, postCategories, posts, postTags, services, tags } from "@/db/schema";
import { isUuid } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";
import { getImage, resolveMediaInHtml } from "@/lib/content/queries";

// Renders an unpublished (or changed) record with the real public templates.
// Uncached, staff only, never indexed (the admin layout sets noindex).

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

type Props = { params: Promise<{ type: string; id: string }> };

export default async function PreviewPage({ params }: Props) {
  const { type, id } = await params;
  if (!isUuid(id)) notFound();
  const db = await getDb();

  let content: React.ReactNode = null;
  let editHref = "/admin/";
  let status = "draft";

  if (type === "post") {
    const user = await requireUserPage("posts.edit_own");
    const [row] = await db.select().from(posts).where(eq(posts.id, id));
    if (!row) notFound();
    if (!can(user.role, "posts.edit_any") && row.authorId !== user.authorId) redirect("/admin/posts/?denied=1");
    const [author] = row.authorId ? await db.select().from(authors).where(eq(authors.id, row.authorId)) : [];
    const [cats, tgs, cms, featuredImage, ogImage, photo] = await Promise.all([
      db.select({ name: categories.name, slug: categories.slug }).from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId)).where(eq(postCategories.postId, id)),
      db.select({ name: tags.name, slug: tags.slug }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(postTags.postId, id)),
      db
        .select({ id: comments.id, parentId: comments.parentId, authorName: comments.authorName, html: comments.html, isStaffReply: comments.isStaffReply, createdAt: comments.createdAt })
        .from(comments)
        .where(and(eq(comments.postId, id), eq(comments.status, "approved")))
        .orderBy(asc(comments.createdAt)),
      getImage(row.featuredImageId),
      getImage(row.seo.ogImageId ?? null),
      getImage(author?.photoId ?? null),
    ]);
    const post: ComponentProps<typeof PostView>["post"] = {
      ...row,
      html: resolveMediaInHtml(row.html),
      featuredImage,
      ogImage,
      author: author ? { name: author.name, slug: author.slug, role: author.role, bio: author.bio, photo } : null,
      categories: cats,
      tags: tgs,
      comments: cms,
      related: [],
    };
    content = <PostView post={post} />;
    editHref = `/admin/posts/${id}/`;
    status = row.status;
  } else if (type === "page") {
    await requireUserPage("pages.manage");
    const [row] = await db.select().from(pages).where(eq(pages.id, id));
    if (!row) notFound();
    const [featuredImage, ogImage] = await Promise.all([getImage(row.featuredImageId), getImage(row.seo.ogImageId ?? null)]);
    content = <PageView page={{ ...row, featuredImage, ogImage }} />;
    editHref = `/admin/pages/${id}/`;
    status = row.status;
  } else if (type === "service") {
    await requireUserPage("services.manage");
    const [row] = await db.select().from(services).where(eq(services.id, id));
    if (!row) notFound();
    const [related, docs, featuredImage, ogImage] = await Promise.all([
      row.relatedServiceIds.length ? db.select({ slug: services.slug, title: services.title, summary: services.summary, icon: services.icon }).from(services).where(inArray(services.id, row.relatedServiceIds)) : Promise.resolve([]),
      row.relatedDocumentIds.length ? db.select({ slug: documents.slug, title: documents.title }).from(documents).where(inArray(documents.id, row.relatedDocumentIds)) : Promise.resolve([]),
      getImage(row.featuredImageId),
      getImage(row.seo.ogImageId ?? null),
    ]);
    content = <ServiceView service={{ ...row, related, documents: docs, featuredImage, ogImage }} />;
    editHref = `/admin/services/${id}/`;
    status = row.status;
  } else if (type === "document") {
    await requireUserPage("documents.manage");
    const [row] = await db.select().from(documents).where(eq(documents.id, id));
    if (!row) notFound();
    const [featuredImage, ogImage] = await Promise.all([getImage(row.featuredImageId), getImage(row.seo.ogImageId ?? null)]);
    content = <DocumentView doc={{ ...row, featuredImage, ogImage }} />;
    editHref = `/admin/documents/${id}/`;
    status = row.status;
  } else {
    notFound();
  }

  return (
    <div className="bg-paper font-sans">
      <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950">
        <span>Preview — {status === "published" ? "showing the saved version" : `not published (${status})`}. Visitors can&apos;t see this page.</span>
        <Link href={editHref} className="rounded-md bg-amber-950 px-3 py-1 text-xs text-white hover:bg-black">
          Back to editor
        </Link>
      </div>
      {content}
    </div>
  );
}
