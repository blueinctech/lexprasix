"use client";

import { useId, useState, type ReactNode } from "react";
import type { SeoFields as Seo } from "@/db/schema";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { Card, Checkbox, cx } from "./ui";

// Shared editor fields: slug, publication status, SEO panel and small list editors.

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15 aria-[invalid=true]:border-red-600";

export function slugify(input: string) {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Title + slug pair: the slug follows the title until edited by hand. */
export function TitleSlugFields({ initialTitle, initialSlug, prefix, slugLocked, titleLabel = "Title" }: { initialTitle: string; initialSlug: string; prefix: string; slugLocked?: boolean; titleLabel?: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [touched, setTouched] = useState(Boolean(initialSlug) || Boolean(slugLocked));
  const tId = useId();
  const sId = useId();
  return (
    <div className="grid gap-4">
      <div data-field className="grid gap-1.5">
        <label htmlFor={tId} className="text-sm font-medium text-slate-800">
          {titleLabel} <span className="text-red-700">*</span>
        </label>
        <input
          id={tId}
          name="title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
          className={cx(inputCls, "text-base font-medium")}
        />
      </div>
      <div data-field className="grid gap-1.5">
        <label htmlFor={sId} className="text-sm font-medium text-slate-800">
          URL
        </label>
        <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 text-sm focus-within:border-navy-700">
          <span className="shrink-0 pl-3 text-slate-500">{prefix}</span>
          <input
            id={sId}
            name="slug"
            value={slug}
            readOnly={slugLocked}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
            className="min-w-0 flex-1 bg-transparent px-1 py-2 focus:outline-none read-only:text-slate-500"
          />
          <span className="pr-3 text-slate-500">/</span>
        </div>
        {!slugLocked && initialSlug && slug !== initialSlug && <span className="text-xs text-amber-700">Changing a published URL adds a permanent redirect from the old address.</span>}
      </div>
    </div>
  );
}

export function StatusFields({ status, publishedAtInput, canPublish, note }: { status: string; publishedAtInput: string; canPublish: boolean; note?: ReactNode }) {
  const [value, setValue] = useState(canPublish ? status : "draft");
  const id = useId();
  return (
    <Card title="Publishing">
      <div className="grid gap-4">
        <div data-field className="grid gap-1.5">
          <label htmlFor={id} className="text-sm font-medium text-slate-800">
            Status
          </label>
          <select id={id} name="status" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} disabled={!canPublish && status !== "draft"}>
            <option value="draft">Draft (not public)</option>
            {canPublish && <option value="scheduled">Scheduled</option>}
            {canPublish && <option value="published">Published</option>}
            {!canPublish && status !== "draft" && <option value={status}>{status}</option>}
          </select>
          {!canPublish && <span className="text-xs text-slate-500">An editor publishes your article after review.</span>}
        </div>
        {canPublish && value !== "draft" && (
          <div data-field className="grid gap-1.5">
            <label htmlFor={`${id}-d`} className="text-sm font-medium text-slate-800">
              {value === "scheduled" ? "Publish on" : "Publication date"} <span className="font-normal text-slate-500">(Lagos time)</span>
            </label>
            <input id={`${id}-d`} type="datetime-local" name="publishedAt" defaultValue={publishedAtInput} required={value === "scheduled"} className={inputCls} />
            {value === "published" && <span className="text-xs text-slate-500">Leave as is to keep the original date. Empty means now.</span>}
          </div>
        )}
        {note}
      </div>
    </Card>
  );
}

export function SeoPanel({ seo, defaultTitle, defaultDescription, path, ogImage }: { seo: Seo; defaultTitle: string; defaultDescription: string; path: string; ogImage?: PickedMedia | null }) {
  const [title, setTitle] = useState(seo.title ?? "");
  const [desc, setDesc] = useState(seo.description ?? "");
  const shownTitle = title || defaultTitle;
  const shownDesc = desc || defaultDescription;
  const legacy = seo.legacy as { title?: string; description?: string } | undefined;
  const count = (n: number, ideal: [number, number]) => (
    <span className={cx("text-xs", n === 0 ? "text-slate-400" : n < ideal[0] || n > ideal[1] ? "text-amber-700" : "text-emerald-700")}>
      {n} characters (aim for {ideal[0]}–{ideal[1]})
    </span>
  );
  return (
    <Card title="Search & social">
      <div className="grid gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="truncate text-xs text-slate-600">lexpraxisng.com{path}</p>
          <p className="mt-0.5 line-clamp-1 text-lg text-[#1a0dab]">{shownTitle}</p>
          <p className="line-clamp-2 text-sm text-slate-600">{shownDesc}</p>
        </div>
        <div data-field className="grid gap-1.5">
          <label className="text-sm font-medium text-slate-800" htmlFor="seo_title">
            SEO title
          </label>
          <input id="seo_title" name="seo_title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle} maxLength={200} className={inputCls} />
          {count(shownTitle.length, [30, 60])}
        </div>
        <div data-field className="grid gap-1.5">
          <label className="text-sm font-medium text-slate-800" htmlFor="seo_description">
            Meta description
          </label>
          <textarea id="seo_description" name="seo_description" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={defaultDescription} maxLength={400} className={inputCls} />
          {count(shownDesc.length, [120, 160])}
        </div>
        <details className="rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-800">Advanced: canonical, indexing, social sharing</summary>
          <div className="mt-4 grid gap-4">
            <div data-field className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="seo_canonical">
                Canonical URL
              </label>
              <input id="seo_canonical" name="seo_canonical" type="url" defaultValue={seo.canonical ?? ""} placeholder="Leave empty to use this page's own URL" className={inputCls} />
            </div>
            <Checkbox name="seo_noindex" label="Hide from search engines (noindex)" defaultChecked={Boolean(seo.noindex)} hint="Also removes the page from the sitemap." />
            <Checkbox name="seo_nofollow" label="Ask search engines not to follow links (nofollow)" defaultChecked={Boolean(seo.nofollow)} />
            <div data-field className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="seo_ogTitle">
                Social title
              </label>
              <input id="seo_ogTitle" name="seo_ogTitle" defaultValue={seo.ogTitle ?? ""} placeholder="Same as SEO title" className={inputCls} />
            </div>
            <div data-field className="grid gap-1.5">
              <label className="text-sm font-medium text-slate-800" htmlFor="seo_ogDescription">
                Social description
              </label>
              <textarea id="seo_ogDescription" name="seo_ogDescription" rows={2} defaultValue={seo.ogDescription ?? ""} placeholder="Same as meta description" className={inputCls} />
            </div>
            <MediaField name="seo_ogImageId" label="Social sharing image" initial={ogImage} hint="Shown when the page is shared on LinkedIn, WhatsApp, etc. 1200×630 works best." />
            {legacy?.title && (
              <p className="text-xs text-slate-500">
                Imported from WordPress (Yoast): “{legacy.title}”{legacy.description ? ` — ${legacy.description}` : ""}
              </p>
            )}
          </div>
        </details>
      </div>
    </Card>
  );
}

/** Editable list of objects (FAQ, process steps…) serialised to a hidden JSON input. */
export function ItemsEditor<T extends Record<string, string>>({ name, label, initial, fields, addLabel = "Add item", max = 30 }: { name: string; label: string; initial: T[]; fields: { key: keyof T & string; label: string; multiline?: boolean }[]; addLabel?: string; max?: number }) {
  const [items, setItems] = useState<T[]>(initial);
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, ""])) as T;
  const update = (i: number, key: string, v: string) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  const move = (i: number, d: number) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const copy = [...xs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  return (
    <div data-field className="grid gap-2">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      {items.map((item, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          {fields.map((f) =>
            f.multiline ? (
              <textarea key={f.key} aria-label={`${f.label} ${i + 1}`} placeholder={f.label} rows={3} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} className={inputCls} />
            ) : (
              <input key={f.key} aria-label={`${f.label} ${i + 1}`} placeholder={f.label} value={item[f.key] ?? ""} onChange={(e) => update(i, f.key, e.target.value)} className={inputCls} />
            ),
          )}
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-slate-600 hover:text-slate-900 disabled:opacity-40">
              ↑ Up
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-slate-600 hover:text-slate-900 disabled:opacity-40">
              ↓ Down
            </button>
            <button type="button" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="ml-auto text-red-700 hover:underline">
              Remove
            </button>
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" onClick={() => setItems((xs) => [...xs, blank()])} className="justify-self-start rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-navy-700">
          + {addLabel}
        </button>
      )}
    </div>
  );
}

/** One value per line. */
export function LinesField({ name, label, initial, hint }: { name: string; label: string; initial: string[]; hint?: string }) {
  const id = useId();
  return (
    <div data-field className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      <textarea id={id} name={name} rows={4} defaultValue={initial.join("\n")} className={inputCls} />
      <span className="text-xs text-slate-500">{hint ?? "One per line."}</span>
    </div>
  );
}
