"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { deletePost, savePost } from "@/app/admin/_actions/posts";
import type { SeoFields } from "@/db/schema";
import { SeoPanel, StatusFields, TitleSlugFields } from "./EditorFields";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { ActionForm, btn, Card, Select, SubmitButton, TextArea, TextInput } from "./ui";

export type PostEditorData = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  html: string;
  status: string;
  publishedAtInput: string;
  authorId: string | null;
  featuredImage: PickedMedia | null;
  ogImage: PickedMedia | null;
  seo: SeoFields;
  categoryIds: string[];
  tags: string;
  readingMinutes: number;
  comments: number;
};

export function PostEditor({
  post,
  authors,
  categories,
  canPublish,
  canChooseAuthor,
  canDelete,
  sidebarExtra,
}: {
  post: PostEditorData;
  authors: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  canPublish: boolean;
  canChooseAuthor: boolean;
  canDelete: boolean;
  sidebarExtra?: ReactNode;
}) {
  return (
    <div className="grid gap-6">
      <ActionForm action={savePost}>
        {post.id && <input type="hidden" name="id" value={post.id} />}
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid min-w-0 content-start gap-6">
            <Card>
              <div className="grid gap-5">
                <TitleSlugFields initialTitle={post.title} initialSlug={post.slug} prefix="lexpraxisng.com/" />
                <TextArea
                  label="Excerpt"
                  name="excerpt"
                  defaultValue={post.excerpt}
                  rows={3}
                  maxLength={600}
                  hint="Shown on article cards and used as the meta description when none is set. Leave empty to use the first lines of the article."
                />
                <RichTextEditor name="html" initialHtml={post.html} label="Article" minHeight="28rem" />
              </div>
            </Card>
            <SeoPanel
              seo={post.seo}
              defaultTitle={`${post.title || "Article title"} - Lexpraxis Solicitors`}
              defaultDescription={post.excerpt || "The article excerpt is used."}
              path={`/${post.slug || "…"}/`}
              ogImage={post.ogImage}
            />
          </div>
          <div className="grid content-start gap-6">
            <StatusFields status={post.status} publishedAtInput={post.publishedAtInput} canPublish={canPublish} />
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{post.id ? "Save changes" : "Create article"}</SubmitButton>
              {post.id && (
                <Link href={`/admin/preview/post/${post.id}/`} target="_blank" className={btn("secondary")}>
                  Preview
                </Link>
              )}
              {post.id && post.status === "published" && (
                <a href={`/${post.slug}/`} target="_blank" rel="noopener" className={btn("ghost")}>
                  View live
                </a>
              )}
            </div>
            <Card title="Details">
              <div className="grid gap-4">
                {canChooseAuthor ? (
                  <Select
                    label="Author"
                    name="authorId"
                    defaultValue={post.authorId ?? ""}
                    options={[{ value: "", label: "— No author —" }, ...authors.map((a) => ({ value: a.id, label: a.name }))]}
                  />
                ) : (
                  <p className="text-sm text-slate-600">Author: {authors.find((a) => a.id === post.authorId)?.name ?? "you"}</p>
                )}
                <MediaField name="featuredImageId" label="Featured image" initial={post.featuredImage} />
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm font-medium text-slate-800">Categories</legend>
                  <div className="grid max-h-52 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
                    {categories.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={post.categoryIds.includes(c.id)} className="size-4 accent-navy-900" />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <TextInput label="Tags" name="tags" defaultValue={post.tags} hint="Comma separated. New tags are created automatically." />
                {post.id && (
                  <p className="text-xs text-slate-500">
                    {post.readingMinutes} min read · {post.comments} archived comment{post.comments === 1 ? "" : "s"} (read-only)
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </ActionForm>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6 xl:col-start-2">
          {sidebarExtra}
          {post.id && canDelete && (
            <Card title="Danger zone">
              <ActionForm action={deletePost}>
                <input type="hidden" name="id" value={post.id} />
                <p className="text-sm text-slate-600">Deleting removes the article from the website. If it was live, consider adding a redirect.</p>
                <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this article permanently?">
                  Delete article
                </SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
