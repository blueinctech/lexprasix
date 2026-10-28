"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { deleteService, saveService } from "@/app/admin/_actions/services";
import type { SeoFields } from "@/db/schema";
import { Icon } from "@/components/ui/Icon";
import { ItemsEditor, SeoPanel, StatusFields, TitleSlugFields } from "./EditorFields";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { ActionForm, btn, Card, SubmitButton, TextArea, TextInput } from "./ui";

export type ServiceEditorData = {
  id: string | null;
  title: string;
  slug: string;
  shortTitle: string;
  summary: string;
  body: string;
  audience: string;
  process: { title: string; text: string }[];
  faqs: { question: string; answer: string }[];
  relatedServiceIds: string[];
  relatedDocumentIds: string[];
  ctaLabel: string;
  ctaHref: string;
  icon: string;
  status: string;
  publishedAtInput: string;
  featuredImage: PickedMedia | null;
  ogImage: PickedMedia | null;
  seo: SeoFields;
};

const ICONS = ["subscription", "building", "globe", "receipt", "badge", "license", "contract", "growth", "search", "hands", "home", "shield", "user-shield", "scale", "file-text"];

export function ServiceEditor({ service, otherServices, documents, sidebarExtra }: { service: ServiceEditorData; otherServices: { id: string; title: string }[]; documents: { id: string; title: string }[]; sidebarExtra?: ReactNode }) {
  return (
    <div className="grid gap-6">
      <ActionForm action={saveService}>
        {service.id && <input type="hidden" name="id" value={service.id} />}
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="grid min-w-0 content-start gap-6">
            <Card>
              <div className="grid gap-5">
                <TitleSlugFields initialTitle={service.title} initialSlug={service.slug} prefix="lexpraxisng.com/service/" />
                <TextInput label="Short name" name="shortTitle" defaultValue={service.shortTitle} maxLength={80} hint="Used on cards and in menus, e.g. “Company Formation (Nigeria)”." />
                <TextArea label="Summary" name="summary" defaultValue={service.summary} rows={3} maxLength={600} hint="One or two sentences shown on service cards and under the page title." />
                <RichTextEditor name="body" initialHtml={service.body} label="Description" />
                <TextArea label="Who this is for" name="audience" defaultValue={service.audience} rows={3} maxLength={1000} />
              </div>
            </Card>
            <Card title="How it works">
              <ItemsEditor name="process" label="Process steps" initial={service.process} fields={[{ key: "title", label: "Step" }, { key: "text", label: "What happens", multiline: true }]} addLabel="Add step" max={8} />
            </Card>
            <Card title="Frequently asked questions">
              <ItemsEditor name="faqs" label="FAQs" initial={service.faqs} fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer", multiline: true }]} addLabel="Add question" />
            </Card>
            <SeoPanel seo={service.seo} defaultTitle={`${service.title || "Service"} - Lexpraxis Solicitors`} defaultDescription={service.summary || "The service summary is used."} path={`/service/${service.slug || "…"}/`} ogImage={service.ogImage} />
          </div>
          <div className="grid content-start gap-6">
            <StatusFields status={service.status} publishedAtInput={service.publishedAtInput} canPublish />
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{service.id ? "Save changes" : "Create service"}</SubmitButton>
              {service.id && (
                <Link href={`/admin/preview/service/${service.id}/`} target="_blank" className={btn("secondary")}>
                  Preview
                </Link>
              )}
            </div>
            <Card title="Call to action">
              <div className="grid gap-4">
                <TextInput label="Button text" name="ctaLabel" defaultValue={service.ctaLabel} placeholder="Book a free consultation" />
                <TextInput label="Button link" name="ctaHref" defaultValue={service.ctaHref} placeholder="/book-appointment/" />
              </div>
            </Card>
            <Card title="Appearance">
              <div className="grid gap-4">
                <fieldset>
                  <legend className="mb-2 text-sm font-medium text-slate-800">Icon</legend>
                  <div className="grid grid-cols-5 gap-2">
                    {ICONS.map((icon) => (
                      <label key={icon} className="grid cursor-pointer place-items-center rounded-lg border border-slate-200 p-2 has-checked:border-navy-700 has-checked:bg-navy-50" title={icon}>
                        <input type="radio" name="icon" value={icon} defaultChecked={service.icon === icon} className="sr-only" />
                        <Icon name={icon} className="size-5 text-navy-700" label={icon} />
                      </label>
                    ))}
                  </div>
                </fieldset>
                <MediaField name="featuredImageId" label="Featured image" initial={service.featuredImage} />
              </div>
            </Card>
            <Card title="Related">
              <div className="grid gap-4">
                <CheckList name="relatedServiceIds" legend="Related services" options={otherServices} checked={service.relatedServiceIds} hint="Leave empty to show three other services." />
                <CheckList name="relatedDocumentIds" legend="Start-online documents" options={documents} checked={service.relatedDocumentIds} />
              </div>
            </Card>
          </div>
        </div>
      </ActionForm>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-6 xl:col-start-2">
          {sidebarExtra}
          {service.id && (
            <Card title="Danger zone">
              <ActionForm action={deleteService}>
                <input type="hidden" name="id" value={service.id} />
                <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this service permanently? Consider unpublishing instead.">
                  Delete service
                </SubmitButton>
              </ActionForm>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export function CheckList({ name, legend, options, checked, hint }: { name: string; legend: string; options: { id: string; title: string }[]; checked: string[]; hint?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-800">{legend}</legend>
      <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.id} defaultChecked={checked.includes(o.id)} className="size-4 accent-navy-900" />
            {o.title}
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </fieldset>
  );
}
