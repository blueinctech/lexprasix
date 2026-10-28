import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Flash } from "@/components/admin/ContentList";
import { PostEditor } from "@/components/admin/PostEditor";
import { RevisionsList } from "@/components/admin/RevisionsList";
import { Badge, PageTitle } from "@/components/admin/ui";
import { isUuid } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";
import { editorOptions, loadPost } from "../load";

export const metadata: Metadata = { title: "Edit article" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("posts.edit_own");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [post, options, sp] = await Promise.all([loadPost(id), editorOptions(), searchParams]);
  if (!post) notFound();
  const editAny = can(user.role, "posts.edit_any");
  // Authors may only open their own articles.
  if (!editAny && post.authorId !== user.authorId) redirect("/admin/posts/?denied=1");
  const locked = !editAny && post.status !== "draft";
  return (
    <>
      <PageTitle title={post.data.title} description={<Badge value={post.status} />} back={{ href: "/admin/posts/", label: "All articles" }} />
      <Flash params={sp} />
      {locked && <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">This article is live or scheduled. Only an editor can change it now.</p>}
      <PostEditor
        post={post.data}
        authors={options.authors}
        categories={options.categories}
        canPublish={can(user.role, "posts.publish")}
        canChooseAuthor={editAny}
        canDelete={can(user.role, "posts.delete")}
        sidebarExtra={<RevisionsList type="post" id={id} canRestore={editAny} />}
      />
    </>
  );
}
