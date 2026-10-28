"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { deletePage, savePage } from "@/app/admin/_actions/pages";
import type { SeoFields } from "@/db/schema";
import { BlockEditor } from "./BlockEditor";
import { SeoPanel, StatusFields, TitleSlugFields } from "./EditorFields";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { ActionForm, btn, Card, Select, SubmitButton, TextArea } from "./ui";

export type PageEditorData = {
  id: string | null;
  title: string;
  path: string;
  template: string;
  summary: string;
  blocks: ({ id: string; type: string } & Record<string, unknown>)[];
  status: string;
  publishedAtInput: string;
  featuredImage: PickedMedia | null;
  ogImage: PickedMedia | null;
  seo: SeoFields;
};

const TEMPLATES = [
  { value: "default", label: "Standard page" },
  { value: "landing", label: "Landing page" },
  { value: "legal", label: "Legal / policy page" },
  { value: "contact", label: "Contact page" },
  { value: "booking", label: "Booking page" },
  { value: "reviews", label: "Reviews page" },
];

const INDEX_NOTE: Record<string, string> = {
  blog: "The article list is generated automatically.",
  service: "The services grid is generated from Services.",
  "legal-forms": "The document list is generated from Legal documents.",
  "corporate-filings": "The filings list is generated from Legal documents.",
};

export function PageEditor({ page, images, sidebarExtra }: { page: PageEditorData; images: Record<string, PickedMedia>; sidebarExtra?: ReactNode }) {
  const isIndex = page.template === "index";
  const isHome = page.path === "" && page.id !== null;
  const fixedUrl = isIndex || isHome;
  const publicPath = page.path ? `/${page.path}/` : "/";
  return (
    <div className="grid gap-6">
      <ActionForm action={savePage}>
        {page.id && <input type="hidden" name="id" value={page.id} />}
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid min-w-0 content-start gap-6">
            <Card>
              <div className="grid gap-5">
                <TitleSlugFields initialTitle={page.title} initialSlug={page.path} prefix="lexpraxisng.com/" slugLocked={fixedUrl} />
                <TextArea label="Summary" name="summary" defaultValue={page.summary} rows={3} maxLength={600} hint="Shown under the page title and used as the meta description when none is set." />
              </div>
            </Card>
            {isIndex ? (
              <Card title="Page content">
                <p className="text-sm text-slate-600">{INDEX_NOTE[page.path] ?? "This page's listing is generated automatically."} Edit the title, summary and SEO here.</p>
              </Card>
            ) : (
              <Card title="Content blocks">
                <BlockEditor initial={page.blocks as never} images={images} />
              </Card>
            )}
            <SeoPanel seo={page.seo} defaultTitle={`${page.title || "Page title"} - Lexpraxis Solicitors`} defaultDescription={page.summary || "The page summary is used."} path={publicPath} ogImage={page.ogImage} />
          </div>
          <div className="grid content-start gap-6">
            <StatusFields status={page.status} publishedAtInput={page.publishedAtInput} canPublish note={isHome ? <p className="text-xs text-slate-500">The homepage must stay published.</p> : undefined} />
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{page.id ? "Save changes" : "Create page"}</SubmitButton>
              {page.id && !isIndex && (
                <Link href={`/admin/preview/page/${page.id}/`} target="_blank" className={btn("secondary")}>
                  Preview
                </Link>
              )}
              {page.id && page.status === "published" && (
                <a href={publicPath} target="_blank" rel="noopener" className={btn("ghost")}>
                  View live
                </a>
              )}
            </div>
            <Card title="Details">
              <div className="grid gap-4">
                {fixedUrl || page.template === "home" ? (
                  <p className="text-sm text-slate-600">Template: {isHome ? "Homepage" : "Generated listing"}</p>
                ) : (
                  <Select label="Template" name="template" defaultValue={page.template} options={TEMPLATES} />
                )}
                <MediaField name="featuredImageId" label="Featured image" initial={page.featuredImage} hint="Used for social sharing when no social image is set." />
              </div>
            </Card>
          </div>
        </div>
      </ActionForm>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6 xl:col-start-2">
          {sidebarExtra}
          {page.id && !fixedUrl && page.template !== "home" && (
            <Card title="Danger zone">
              <ActionForm action={deletePage}>
                <input type="hidden" name="id" value={page.id} />
                <p className="text-sm text-slate-600">Deleting removes the page from the website. If it was live, consider adding a redirect.</p>
                <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this page permanently?">
                  Delete page
                </SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
