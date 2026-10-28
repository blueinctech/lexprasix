"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { deleteMedia, finalizeMediaReplace, finalizeMediaUpload, updateMedia } from "@/app/admin/_actions/media";
import { Icon } from "@/components/ui/Icon";
import { ActionForm, btn, Checkbox, SubmitButton, TextArea, TextInput } from "./ui";

type Item = { name: string; status: "uploading" | "done" | "error"; message?: string };

type Signed = { ok: boolean; error?: string; key?: string; uploadKey?: string; url?: string; headers?: Record<string, string> };

async function signAndPut(file: File, mediaId?: string): Promise<Signed> {
  const res = await fetch("/admin/api/media/upload/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size, ...(mediaId ? { mediaId } : {}) }),
  });
  const signed = (await res.json().catch(() => ({ ok: false, error: "Upload failed." }))) as Signed;
  if (!signed.ok || !signed.url) return signed;
  const put = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: file });
  if (!put.ok) return { ok: false, error: "Upload to storage failed. Please try again." };
  return signed;
}

/** Drop zone / picker for several files. Each file is signed, uploaded straight to storage, then verified on the server. */
export function MediaUploader({ accept }: { accept: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: File[]) {
    const start = items.length;
    setItems((prev) => [...prev, ...files.map((f) => ({ name: f.name, status: "uploading" as const }))]);
    const set = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((x, j) => (j === start + i ? { ...x, ...patch } : x)));
    await Promise.all(
      files.map(async (file, i) => {
        try {
          const signed = await signAndPut(file);
          if (!signed.ok || !signed.key) return set(i, { status: "error", message: signed.error ?? "Upload failed." });
          const result = await finalizeMediaUpload({ key: signed.key, filename: file.name });
          set(i, result.status === "ok" ? { status: "done" } : { status: "error", message: result.message });
        } catch {
          set(i, { status: "error", message: "Upload failed. Check your connection." });
        }
      }),
    );
    router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files.length) upload([...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${drag ? "border-navy-700 bg-navy-50" : "border-slate-300 bg-white"}`}
      >
        <Icon name="upload" className="size-7 text-navy-700" />
        <p className="text-sm text-slate-700">Drag files here, or</p>
        <button type="button" className={btn("secondary", true)} onClick={() => input.current?.click()}>
          Choose files
        </button>
        <p className="text-xs text-slate-500">Images (JPG, PNG, WebP, GIF), PDF, Word, Excel, PowerPoint or MP4 · up to 15 MB each</p>
        <input
          ref={input}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          aria-label="Choose files to upload"
          onChange={(e) => {
            if (e.target.files?.length) upload([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-sm" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
              <span className="truncate">{it.name}</span>
              <span className={`shrink-0 text-xs ${it.status === "error" ? "text-red-700" : it.status === "done" ? "text-emerald-700" : "text-slate-500"}`}>
                {it.status === "uploading" ? "Uploading…" : it.status === "done" ? "Done" : it.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MediaReplace({ mediaId, accept }: { mediaId: string; accept: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2">
      <label className={btn("secondary")}>
        {busy ? "Uploading…" : "Choose replacement file"}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setStatus(null);
            try {
              const signed = await signAndPut(file, mediaId);
              if (!signed.ok || !signed.uploadKey) setStatus({ ok: false, text: signed.error ?? "Upload failed." });
              else {
                const r = await finalizeMediaReplace({ mediaId, uploadKey: signed.uploadKey });
                setStatus({ ok: r.status === "ok", text: r.message ?? "" });
                if (r.status === "ok") router.refresh();
              }
            } catch {
              setStatus({ ok: false, text: "Upload failed." });
            }
            setBusy(false);
          }}
        />
      </label>
      {status && (
        <p role="status" className={`text-xs ${status.ok ? "text-emerald-700" : "text-red-700"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}

export function CopyButton({ text, label = "Copy URL" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn("secondary", true)}
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
    >
      {done ? "Copied" : label}
    </button>
  );
}

export function MediaDetailsForm({ id, alt, caption, description, isImage }: { id: string; alt: string; caption: string; description: string; isImage: boolean }) {
  return (
    <ActionForm action={updateMedia}>
      <input type="hidden" name="id" value={id} />
      {isImage && <TextInput label="Alt text" name="alt" defaultValue={alt} maxLength={300} hint="Describe the image for people using screen readers and for search engines. Leave empty only for purely decorative images." />}
      {!isImage && <input type="hidden" name="alt" value={alt} />}
      <TextArea label="Caption" name="caption" defaultValue={caption} rows={2} maxLength={1000} />
      <TextArea label="Description (internal)" name="description" defaultValue={description} rows={2} maxLength={2000} />
      <div>
        <SubmitButton>Save details</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function MediaDeleteForm({ id, referenced }: { id: string; referenced: boolean }) {
  return (
    <ActionForm action={deleteMedia}>
      <input type="hidden" name="id" value={id} />
      {referenced && <Checkbox name="force" value="yes" label="Delete anyway" hint="Pages that use this file will show a missing image or broken link." />}
      <div>
        <SubmitButton variant="danger" pendingLabel="Deleting…" confirm="Delete this file permanently? This cannot be undone.">
          Delete file
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
