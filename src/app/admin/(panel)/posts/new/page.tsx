import type { Metadata } from "next";
import { PostEditor } from "@/components/admin/PostEditor";
import { PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";
import { editorOptions } from "../load";

export const metadata: Metadata = { title: "New article" };

export default async function NewPost() {
  const user = await requireUserPage("posts.edit_own");
  const options = await editorOptions();
  const editAny = can(user.role, "posts.edit_any");
  return (
    <>
      <PageTitle title="New article" back={{ href: "/admin/posts/", label: "All articles" }} />
      {!editAny && !user.authorId && (
        <p className="mb-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">Your account isn&apos;t linked to an author profile yet, so you can&apos;t save articles. Ask an administrator to link it.</p>
      )}
      <PostEditor
        post={{ id: null, title: "", slug: "", excerpt: "", html: "", status: "draft", publishedAtInput: "", authorId: user.authorId, featuredImage: null, ogImage: null, seo: {}, categoryIds: [], tags: "", readingMinutes: 0, comments: 0 }}
        authors={options.authors}
        categories={options.categories}
        canPublish={can(user.role, "posts.publish")}
        canChooseAuthor={editAny}
        canDelete={false}
      />
    </>
  );
}
