"use client";

import { useState } from "react";
import { BLOCK_LABELS, type BlockType } from "@/lib/blocks";
import { MediaField } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { btn, cx } from "./ui";

// Visual editor for page blocks. Each block type is described by a field spec;
// the whole list is serialised to a hidden "blocks" JSON input and validated
// on the server against src/lib/blocks.ts.

type Spec =
  | { key: string; label: string; kind: "text" | "textarea" | "url"; hint?: string }
  | { key: string; label: string; kind: "number"; min: number; max: number; def: number; hint?: string }
  | { key: string; label: string; kind: "checkbox"; def: boolean; hint?: string }
  | { key: string; label: string; kind: "link" }
  | { key: string; label: string; kind: "image" }
  | { key: string; label: string; kind: "richtext" }
  | { key: string; label: string; kind: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: "strings"; hint?: string }
  | { key: string; label: string; kind: "items"; fields: { key: string; label: string; multiline?: boolean }[] };

const head = (): Spec[] => [
  { key: "eyebrow", label: "Eyebrow (small label above the heading)", kind: "text" },
  { key: "heading", label: "Heading", kind: "text" },
];

export const BLOCK_SPECS: Record<BlockType, Spec[]> = {
  hero: [
    ...head(),
    { key: "text", label: "Introduction", kind: "textarea" },
    { key: "primary", label: "Main button", kind: "link" },
    { key: "secondary", label: "Second button", kind: "link" },
    { key: "imageId", label: "Image (optional; without one, the 'start online' panel is shown)", kind: "image" },
    { key: "points", label: "Key points", kind: "strings", hint: "Up to 6, one per line." },
  ],
  richText: [
    { key: "heading", label: "Heading (optional)", kind: "text" },
    { key: "html", label: "Text", kind: "richtext" },
  ],
  services: [...head(), { key: "text", label: "Introduction", kind: "textarea" }, { key: "limit", label: "How many services (0 = all)", kind: "number", min: 0, max: 30, def: 0 }],
  steps: [...head(), { key: "items", label: "Steps", kind: "items", fields: [{ key: "title", label: "Step title" }, { key: "text", label: "Description", multiline: true }] }],
  features: [...head(), { key: "text", label: "Introduction", kind: "textarea" }, { key: "items", label: "Features", kind: "items", fields: [{ key: "title", label: "Title" }, { key: "text", label: "Description", multiline: true }] }],
  stats: [
    { key: "verified", label: "These figures are verified and current", kind: "checkbox", def: false, hint: "Unverified figures are never shown on the website. Only tick this once the firm has confirmed every number." },
    { key: "items", label: "Figures", kind: "items", fields: [{ key: "value", label: "Value, e.g. 250+" }, { key: "label", label: "Label, e.g. Businesses" }] },
  ],
  documents: [
    ...head(),
    { key: "text", label: "Introduction", kind: "textarea" },
    { key: "group", label: "Which documents", kind: "select", options: [{ value: "all", label: "All" }, { value: "corporate-filings", label: "Corporate filings" }, { value: "agreements", label: "Agreements" }] },
  ],
  latestPosts: [...head(), { key: "count", label: "Number of articles", kind: "number", min: 1, max: 12, def: 3 }],
  faq: [{ key: "heading", label: "Heading", kind: "text" }, { key: "items", label: "Questions", kind: "items", fields: [{ key: "question", label: "Question" }, { key: "answer", label: "Answer", multiline: true }] }],
  cta: [{ key: "heading", label: "Heading", kind: "text" }, { key: "text", label: "Text", kind: "textarea" }, { key: "primary", label: "Main button", kind: "link" }, { key: "secondary", label: "Second button", kind: "link" }],
  quote: [{ key: "text", label: "Quote", kind: "textarea" }, { key: "attribution", label: "Attribution", kind: "text" }],
  offices: [{ key: "heading", label: "Heading", kind: "text" }, { key: "showMap", label: "Show map buttons", kind: "checkbox", def: true }],
  contactForm: [{ key: "heading", label: "Heading", kind: "text" }, { key: "text", label: "Text", kind: "textarea" }],
  calendly: [{ key: "heading", label: "Heading", kind: "text" }, { key: "text", label: "Text", kind: "textarea" }],
  reviews: [{ key: "heading", label: "Heading", kind: "text" }, { key: "text", label: "Text", kind: "textarea" }],
  embed: [{ key: "title", label: "Title (for screen readers)", kind: "text" }, { key: "url", label: "Embed URL (YouTube, Vimeo or Google Maps, https)", kind: "url" }],
};

type Block = { id: string; type: BlockType } & Record<string, unknown>;

function blank(type: BlockType): Block {
  const out: Block = { id: `b${Math.random().toString(36).slice(2, 10)}`, type };
  for (const s of BLOCK_SPECS[type]) {
    if (s.kind === "number") out[s.key] = s.def;
    else if (s.kind === "checkbox") out[s.key] = s.def;
    else if (s.kind === "link") out[s.key] = { label: "", href: "" };
    else if (s.kind === "image") out[s.key] = null;
    else if (s.kind === "strings" || s.kind === "items") out[s.key] = [];
    else if (s.kind === "select") out[s.key] = s.options[0].value;
    else out[s.key] = "";
  }
  return out;
}

const inputCls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";

export function BlockEditor({ initial, images }: { initial: Block[]; images: Record<string, { id: string; url: string; alt: string }> }) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [adding, setAdding] = useState<BlockType>("richText");

  const update = (id: string, key: string, value: unknown) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, [key]: value } : b)));
  const move = (i: number, d: number) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const copy = [...bs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  return (
    <div className="grid gap-3">
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      {blocks.map((b, i) => {
        const isOpen = open === b.id;
        const summary = String(b.heading || b.title || b.text || "").slice(0, 70);
        return (
          <section key={b.id} className="rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center gap-2 px-4 py-2.5">
              <button type="button" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{BLOCK_LABELS[b.type]}</span>
                <span className="truncate text-sm text-slate-600">{summary}</span>
              </button>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Move block up">
                ↑
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="Move block down">
                ↓
              </button>
              <button
                type="button"
                onClick={() => window.confirm(`Remove this ${BLOCK_LABELS[b.type]} block?`) && setBlocks((bs) => bs.filter((x) => x.id !== b.id))}
                className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50"
              >
                Remove
              </button>
            </header>
            {/* Kept mounted (hidden) so rich-text editors keep their state. */}
            <div hidden={!isOpen} className="grid gap-4 border-t border-slate-100 p-4">
              {BLOCK_SPECS[b.type].map((s) => (
                <SpecField key={s.key} spec={s} block={b} images={images} onChange={(v) => update(b.id, s.key, v)} />
              ))}
              {b.type === "stats" && !b.verified && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Hidden on the website until the figures are marked as verified.</p>}
            </div>
          </section>
        );
      })}
      {!blocks.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">This page has no content blocks yet.</p>}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-300 p-3">
        <label className="text-sm text-slate-700" htmlFor="add-block">
          Add block
        </label>
        <select id="add-block" value={adding} onChange={(e) => setAdding(e.target.value as BlockType)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
          {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => (
            <option key={t} value={t}>
              {BLOCK_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={btn("secondary", true)}
          onClick={() => {
            const b = blank(adding);
            setBlocks((bs) => [...bs, b]);
            setOpen(b.id);
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function SpecField({ spec, block, images, onChange }: { spec: Spec; block: Block; images: Record<string, { id: string; url: string; alt: string }>; onChange: (v: unknown) => void }) {
  const v = block[spec.key];
  const id = `${block.id}-${spec.key}`;
  const label = (
    <label htmlFor={id} className="text-sm font-medium text-slate-800">
      {spec.label}
    </label>
  );
  switch (spec.kind) {
    case "text":
    case "url":
      return (
        <div className="grid gap-1.5">
          {label}
          <input id={id} type={spec.kind === "url" ? "url" : "text"} value={String(v ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        </div>
      );
    case "textarea":
      return (
        <div className="grid gap-1.5">
          {label}
          <textarea id={id} rows={3} value={String(v ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        </div>
      );
    case "number":
      return (
        <div className="grid gap-1.5">
          {label}
          <input id={id} type="number" min={spec.min} max={spec.max} value={Number(v ?? spec.def)} onChange={(e) => onChange(Number(e.target.value))} className={cx(inputCls, "w-32")} />
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-start gap-2.5 text-sm text-slate-800">
          <input type="checkbox" checked={Boolean(v)} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-navy-900" />
          <span>
            {spec.label}
            {spec.hint && <span className="block text-xs text-slate-500">{spec.hint}</span>}
          </span>
        </label>
      );
    case "select":
      return (
        <div className="grid gap-1.5">
          {label}
          <select id={id} value={String(v)} onChange={(e) => onChange(e.target.value)} className={inputCls}>
            {spec.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "link": {
      const l = (v as { label: string; href: string }) ?? { label: "", href: "" };
      return (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-slate-800">{spec.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label={`${spec.label} text`} placeholder="Button text" value={l.label} onChange={(e) => onChange({ ...l, label: e.target.value })} className={inputCls} />
            <input aria-label={`${spec.label} link`} placeholder="/contact-us/ or https://…" value={l.href} onChange={(e) => onChange({ ...l, href: e.target.value })} className={inputCls} />
          </div>
        </fieldset>
      );
    }
    case "image":
      return <ImageSpec name={id} label={spec.label} initialId={(v as string | null) ?? null} images={images} onChange={onChange} />;
    case "richtext":
      return <RichTextBridge id={id} label={spec.label} html={String(v ?? "")} onChange={onChange} />;
    case "strings":
      return (
        <div className="grid gap-1.5">
          {label}
          <textarea
            id={id}
            rows={4}
            value={((v as string[]) ?? []).join("\n")}
            onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.replace(/^\s+/, "")))}
            onBlur={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
            className={inputCls}
          />
          {spec.hint && <span className="text-xs text-slate-500">{spec.hint}</span>}
        </div>
      );
    case "items": {
      const items = (v as Record<string, string>[]) ?? [];
      const set = (i: number, key: string, val: string) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: val } : it)));
      return (
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-sm font-medium text-slate-800">{spec.label}</legend>
          {items.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              {spec.fields.map((f) =>
                f.multiline ? (
                  <textarea key={f.key} aria-label={`${f.label} ${i + 1}`} placeholder={f.label} rows={2} value={it[f.key] ?? ""} onChange={(e) => set(i, f.key, e.target.value)} className={inputCls} />
                ) : (
                  <input key={f.key} aria-label={`${f.label} ${i + 1}`} placeholder={f.label} value={it[f.key] ?? ""} onChange={(e) => set(i, f.key, e.target.value)} className={inputCls} />
                ),
              )}
              <div className="flex gap-3 text-xs">
                <button type="button" disabled={i === 0} onClick={() => onChange(swap(items, i, i - 1))} className="text-slate-600 disabled:opacity-30">
                  ↑ Up
                </button>
                <button type="button" disabled={i === items.length - 1} onClick={() => onChange(swap(items, i, i + 1))} className="text-slate-600 disabled:opacity-30">
                  ↓ Down
                </button>
                <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="ml-auto text-red-700 hover:underline">
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...items, Object.fromEntries(spec.fields.map((f) => [f.key, ""]))])} className="justify-self-start rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-navy-700">
            + Add
          </button>
        </fieldset>
      );
    }
  }
}

function swap<T>(xs: T[], i: number, j: number): T[] {
  const copy = [...xs];
  [copy[i], copy[j]] = [copy[j], copy[i]];
  return copy;
}

function RichTextBridge({ label, html, onChange }: { id: string; label: string; html: string; onChange: (v: string) => void }) {
  return <RichTextEditor initialHtml={html} label={label} minHeight="12rem" onChange={onChange} />;
}

function ImageSpec({ label, initialId, images, onChange }: { name: string; label: string; initialId: string | null; images: Record<string, { id: string; url: string; alt: string }>; onChange: (v: string | null) => void }) {
  return <MediaField label={label} initial={initialId ? (images[initialId] ?? null) : null} onChange={(m) => onChange(m?.id ?? null)} />;
}
