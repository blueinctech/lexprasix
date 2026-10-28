"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { btn } from "./ui";

export type PickedMedia = { id: string; url: string; alt: string; width?: number | null; height?: number | null; filename?: string };

type Result = { items: (PickedMedia & { mimeType: string; filename: string })[]; page: number; pages: number; total: number };

/** Modal media browser. Used by MediaField and by the rich-text editor's image button. */
export function MediaBrowser({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (m: PickedMedia) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const load = useCallback(async (query: string, p: number) => {
    setError("");
    try {
      const res = await fetch(`/admin/api/media/?q=${encodeURIComponent(query)}&page=${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Could not load the media library.");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(q, page), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [open, q, page, load]);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={onClose} className="m-auto w-[min(56rem,94vw)] rounded-xl p-0 shadow-2xl backdrop:bg-slate-900/50">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
        <h2 id={titleId} className="text-sm font-semibold">
          Choose an image
        </h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
          <Icon name="x" className="size-4" label="Close" />
        </button>
      </div>
      <div className="p-5">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by file name or alt text"
          aria-label="Search media"
          className="mb-4 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy-700 focus:outline-none"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}
        {data && (
          <>
            <ul className="grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5">
              {data.items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(m);
                      onClose();
                    }}
                    className="group block w-full overflow-hidden rounded-lg border border-slate-200 text-left hover:border-navy-700 focus:border-navy-700 focus:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt={m.alt} loading="lazy" className="aspect-square w-full bg-slate-100 object-cover" />
                    <span className="block truncate px-2 py-1 text-[0.7rem] text-slate-600">{m.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
            {!data.items.length && <p className="py-8 text-center text-sm text-slate-500">No images found.</p>}
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{data.total} images</span>
              <span className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btn("secondary", true)}>
                  Previous
                </button>
                <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className={btn("secondary", true)}>
                  Next
                </button>
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Upload new files in the Media library, then pick them here.</p>
          </>
        )}
      </div>
    </dialog>
  );
}

/** Form field holding a media id in a hidden input, with preview, choose and remove. */
export function MediaField({ name, label, initial, hint, onChange }: { name?: string; label: string; initial?: PickedMedia | null; hint?: string; onChange?: (m: PickedMedia | null) => void }) {
  const [value, setValueState] = useState<PickedMedia | null>(initial ?? null);
  const setValue = (m: PickedMedia | null) => {
    setValueState(m);
    onChange?.(m);
  };
  const [open, setOpen] = useState(false);
  return (
    <div data-field className="grid gap-1.5">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {name && <input type="hidden" name={name} value={value?.id ?? ""} />}
      <div className="flex items-center gap-4 rounded-lg border border-dashed border-slate-300 p-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.url} alt={value.alt} className="size-20 rounded-md bg-slate-100 object-cover" />
        ) : (
          <span className="grid size-20 place-items-center rounded-md bg-slate-100 text-slate-400">
            <Icon name="upload" className="size-6" />
          </span>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setOpen(true)} className={btn("secondary", true)}>
            {value ? "Change image" : "Choose image"}
          </button>
          {value && (
            <button type="button" onClick={() => setValue(null)} className="text-left text-xs text-red-700 hover:underline">
              Remove
            </button>
          )}
        </div>
        {value && !value.alt && <p className="text-xs text-amber-700">This image has no alt text. Add it in the Media library.</p>}
      </div>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
      <MediaBrowser open={open} onClose={() => setOpen(false)} onPick={setValue} />
    </div>
  );
}
