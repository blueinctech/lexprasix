"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { deleteDocument, saveDocument } from "@/app/admin/_actions/documents";
import type { SeoFields } from "@/db/schema";
import { ItemsEditor, LinesField, SeoPanel, StatusFields, TitleSlugFields } from "./EditorFields";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { ActionForm, btn, Card, Select, SubmitButton, TextArea, TextInput } from "./ui";

export type DocumentEditorData = {
  id: string | null;
  title: string;
  slug: string;
  group: string;
  summary: string;
  body: string;
  deliverables: string[];
  requirements: string[];
  faqs: { question: string; answer: string }[];
  formId: string;
  sortOrder: number;
  status: string;
  publishedAtInput: string;
  featuredImage: PickedMedia | null;
  ogImage: PickedMedia | null;
  seo: SeoFields;
};

export function DocumentEditor({ doc, forms, sidebarExtra }: { doc: DocumentEditorData; forms: { value: string; label: string }[]; sidebarExtra?: ReactNode }) {
  return (
    <div className="grid gap-6">
      <ActionForm action={saveDocument}>
        {doc.id && <input type="hidden" name="id" value={doc.id} />}
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid min-w-0 content-start gap-6">
            <Card>
              <div className="grid gap-5">
                <TitleSlugFields initialTitle={doc.title} initialSlug={doc.slug} prefix="lexpraxisng.com/" />
                <TextArea label="Summary" name="summary" defaultValue={doc.summary} rows={3} maxLength={600} hint="Shown under the page title and on document lists." />
                <RichTextEditor name="body" initialHtml={doc.body} label="Introduction (optional, shown above the questionnaire)" minHeight="10rem" />
              </div>
            </Card>
            <Card title="Guidance">
              <div className="grid gap-5">
                <LinesField name="requirements" label="What to have ready" initial={doc.requirements} hint="One per line, e.g. “Valid ID of each director”." />
                <LinesField name="deliverables" label="What the client receives" initial={doc.deliverables} />
                <ItemsEditor name="faqs" label="FAQs" initial={doc.faqs} fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer", multiline: true }]} addLabel="Add question" />
              </div>
            </Card>
            <SeoPanel seo={doc.seo} defaultTitle={`${doc.title || "Document"} - Lexpraxis Solicitors`} defaultDescription={doc.summary || "The summary is used."} path={`/${doc.slug || "…"}/`} ogImage={doc.ogImage} />
          </div>
          <div className="grid content-start gap-6">
            <StatusFields status={doc.status} publishedAtInput={doc.publishedAtInput} canPublish />
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{doc.id ? "Save changes" : "Create page"}</SubmitButton>
              {doc.id && (
                <Link href={`/admin/preview/document/${doc.id}/`} target="_blank" className={btn("secondary")}>
                  Preview
                </Link>
              )}
            </div>
            <Card title="Settings">
              <div className="grid gap-4">
                <Select label="Group" name="group" defaultValue={doc.group} options={[{ value: "corporate-filings", label: "Corporate filings" }, { value: "agreements", label: "Agreements" }]} />
                <Select label="Questionnaire" name="formId" defaultValue={doc.formId} options={[{ value: "", label: "— Choose —" }, ...forms]} hint="The form fields themselves are defined in code (migrated from Gravity Forms)." />
                <TextInput label="Order in lists" name="sortOrder" type="number" min={0} max={999} defaultValue={doc.sortOrder} />
                <MediaField name="featuredImageId" label="Featured image" initial={doc.featuredImage} />
              </div>
            </Card>
          </div>
        </div>
      </ActionForm>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6 xl:col-start-2">
          {sidebarExtra}
          {doc.id && (
            <Card title="Danger zone">
              <ActionForm action={deleteDocument}>
                <input type="hidden" name="id" value={doc.id} />
                <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this page permanently? Consider unpublishing instead.">
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
