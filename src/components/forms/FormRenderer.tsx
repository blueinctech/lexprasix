"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { submitFormAction } from "@/app/actions/forms";
import type { SubmitResult } from "@/forms/server";
import type { FieldDef, FormDefinition, NoteDef } from "@/forms/types";
import { validateFields, type FieldErrors, type FormValues } from "@/forms/validate";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/primitives";

// Renders any FormDefinition: one step at a time with progress, per-step
// validation, accessible errors, direct-to-storage uploads and a session draft
// so a refresh doesn't lose a long questionnaire. Success is only shown after
// the server confirms the submission was stored.

type Upload = { id: string; name: string; size: number; status: "uploading" | "done" | "error"; error?: string };

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[0.97rem] text-ink shadow-[0_1px_0_rgba(20,26,38,.03)] transition-colors placeholder:text-ink-muted/60 hover:border-navy-900/30 focus:border-navy-700 focus:outline-none focus:ring-4 focus:ring-navy-700/10 aria-[invalid=true]:border-red-600 aria-[invalid=true]:ring-red-600/10";

const noopSubscribe = () => () => {};

function readStorage(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function randomKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function FormRenderer({ def, compact = false }: { def: FormDefinition; compact?: boolean }) {
  const formId = useId();
  const draftKey = `lp-form-draft:${def.id}`;
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploads, setUploads] = useState<Record<string, Upload[]>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [honeypot, setHoneypot] = useState("");
  const idempotencyKey = useRef<string>("");
  const startedAt = useRef<number>(0);
  const topRef = useRef<HTMLDivElement>(null);
  const total = def.steps.length;
  const current = def.steps[step];
  const stepFields = useMemo(() => current.items.filter((i): i is FieldDef => i.kind === "field"), [current]);
  const isLast = step === total - 1;

  useEffect(() => {
    idempotencyKey.current = randomKey();
    startedAt.current = Date.now();
  }, []);

  // A draft saved earlier in this browser tab (null while server-rendering).
  const savedDraft = useSyncExternalStore(
    noopSubscribe,
    () => readStorage(draftKey),
    () => null,
  );
  const [draftDismissed, setDraftDismissed] = useState(false);
  const offerDraft = Boolean(savedDraft) && !draftDismissed && Object.keys(values).length === 0;

  const restoreDraft = () => {
    try {
      const parsed = JSON.parse(savedDraft ?? "{}") as { values?: FormValues; step?: number };
      // Files are not kept in drafts; drop any stale upload ids.
      const fileIds = new Set(def.steps.flatMap((s) => s.items).filter((i) => i.kind === "field" && i.type === "file").map((i) => i.id));
      setValues(Object.fromEntries(Object.entries(parsed.values ?? {}).filter(([k]) => !fileIds.has(k))));
      setStep(Math.min(parsed.step ?? 0, def.steps.length - 1));
    } catch {
      /* corrupt draft */
    }
    setDraftDismissed(true);
  };

  const discardDraft = () => {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setDraftDismissed(true);
  };

  useEffect(() => {
    if (result?.status === "success") return;
    try {
      if (Object.keys(values).length) sessionStorage.setItem(draftKey, JSON.stringify({ values, step }));
    } catch {
      /* storage unavailable */
    }
  }, [values, step, draftKey, result]);

  const set = (id: string, v: string | string[]) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)));
  };

  const focusFirstError = (errs: FieldErrors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => document.getElementById(`${formId}-${first}`)?.focus());
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const next = () => {
    const errs = validateFields(stepFields, values);
    const uploadingHere = stepFields.some((f) => uploads[f.id]?.some((u) => u.status === "uploading"));
    if (uploadingHere) return;
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);
    setStep((s) => Math.min(s + 1, total - 1));
    scrollTop();
  };

  const back = () => {
    setStep((s) => Math.max(s - 1, 0));
    scrollTop();
  };

  async function uploadFiles(field: FieldDef, files: FileList) {
    const existing = uploads[field.id] ?? [];
    const room = (field.maxFiles ?? 1) - existing.filter((u) => u.status !== "error").length;
    const list = [...files].slice(0, Math.max(0, room));
    for (const file of list) {
      const temp: Upload = { id: `tmp-${randomKey()}`, name: file.name, size: file.size, status: "uploading" };
      setUploads((prev) => ({ ...prev, [field.id]: [...(prev[field.id] ?? []), temp] }));
      const update = (patch: Partial<Upload>) =>
        setUploads((prev) => ({ ...prev, [field.id]: (prev[field.id] ?? []).map((u) => (u.id === temp.id ? { ...u, ...patch } : u)) }));
      try {
        const res = await fetch("/api/uploads/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formId: def.id, fieldId: field.id, filename: file.name, size: file.size }) });
        const sign = (await res.json()) as { ok: boolean; error?: string; uploadId?: string; url?: string; headers?: Record<string, string> };
        if (!sign.ok || !sign.url || !sign.uploadId) throw new Error(sign.error || "Upload failed.");
        const put = await fetch(sign.url, { method: "PUT", headers: sign.headers, body: file });
        if (!put.ok) throw new Error("Upload failed. Please try again.");
        update({ id: sign.uploadId, status: "done" });
        setValues((prev) => ({ ...prev, [field.id]: [...((prev[field.id] as string[]) ?? []), sign.uploadId!] }));
        setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== field.id)));
      } catch (err) {
        update({ status: "error", error: err instanceof Error ? err.message : "Upload failed." });
      }
    }
  }

  const removeUpload = (fieldId: string, id: string) => {
    setUploads((prev) => ({ ...prev, [fieldId]: (prev[fieldId] ?? []).filter((u) => u.id !== id) }));
    setValues((prev) => ({ ...prev, [fieldId]: ((prev[fieldId] as string[]) ?? []).filter((x) => x !== id) }));
  };

  const submit = () => {
    const errs = validateFields(stepFields, values);
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError(errs);
    if (Object.values(uploads).flat().some((u) => u.status === "uploading")) return;
    startTransition(async () => {
      const params = new URLSearchParams(window.location.search);
      const utm = Object.fromEntries([...params.entries()].filter(([k]) => k.startsWith("utm_")));
      let res: SubmitResult;
      try {
        res = await submitFormAction({ formId: def.id, values, website: honeypot, elapsedMs: Date.now() - startedAt.current, idempotencyKey: idempotencyKey.current, pagePath: window.location.pathname, utm });
      } catch {
        res = { status: "error", message: "We couldn't reach the server. Check your connection and try again — your answers are still here." };
      }
      setResult(res);
      if (res.status === "invalid") {
        setErrors(res.errors);
        // Jump to the first step that has an error.
        const firstStep = def.steps.findIndex((s) => s.items.some((i) => i.kind === "field" && res.errors[i.id]));
        if (firstStep >= 0) setStep(firstStep);
        focusFirstError(res.errors);
      }
      if (res.status === "success") {
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
        (window.dataLayer ??= []).push({ event: "form_submit", form_id: def.id, form_type: def.kind });
        scrollTop();
      }
    });
  };

  if (result?.status === "success") {
    return (
      <div ref={topRef} role="status" className="rounded-2xl border border-emerald-700/20 bg-emerald-50/60 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-white">
            <Icon name="check" className="size-5" />
          </span>
          <div>
            <h3 className="font-display text-2xl text-navy-950">Request received</h3>
            <p className="mt-2 text-ink-muted">{result.message}</p>
            <p className="mt-4 text-sm text-ink">
              Your reference: <strong className="font-mono tracking-wide">{result.reference}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={topRef} className="scroll-mt-28">
      {offerDraft && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gold-100 px-4 py-3 text-sm text-navy-950">
          <span>You have unsent answers from earlier in this session.</span>
          <span className="flex gap-2">
            <button type="button" onClick={restoreDraft} className={buttonClass("primary", "sm")}>
              Restore
            </button>
            <button type="button" onClick={discardDraft} className={buttonClass("outline", "sm")}>
              Start fresh
            </button>
          </span>
        </div>
      )}
      {total > 1 && (
        <div className="mb-8">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <p className="font-medium text-navy-950">
              Step {step + 1} of {total}: {current.title}
            </p>
            <p className="text-ink-muted">{Math.round(((step + 1) / total) * 100)}%</p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-navy-900/10" aria-hidden="true">
            <div className="h-full rounded-full bg-gold-500 transition-[width] duration-500" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (isLast) submit();
          else next();
        }}
        aria-describedby={result?.status === "error" || result?.status === "invalid" ? `${formId}-status` : undefined}
      >
        {/* Honeypot: hidden from people and assistive tech. */}
        <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="website" />
          </label>
        </div>

        {total > 1 && current.description && <p className="mb-6 text-ink-muted">{current.description}</p>}

        <div className={`grid gap-x-5 ${compact ? "gap-y-4" : "gap-y-6"} sm:grid-cols-2`}>
          {current.items.map((item) =>
            item.kind === "note" ? (
              <Note key={item.id} note={item} />
            ) : (
              <Field
                key={item.id}
                field={item}
                formId={formId}
                value={values[item.id]}
                error={errors[item.id]}
                onChange={(v) => set(item.id, v)}
                uploads={uploads[item.id] ?? []}
                onFiles={(files) => uploadFiles(item, files)}
                onRemove={(id) => removeUpload(item.id, id)}
              />
            ),
          )}
        </div>

        {(result?.status === "error" || result?.status === "invalid") && (
          <p id={`${formId}-status`} role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            <Icon name="x" className="mt-0.5 size-4 shrink-0" />
            {result.message}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={back} className={buttonClass("outline")}>
              <Icon name="arrow-left" className="size-4" /> Back
            </button>
          )}
          <button type="submit" disabled={pending} className={buttonClass("primary")}>
            {pending ? "Sending…" : isLast ? def.submitLabel : "Continue"}
            {!pending && <Icon name="arrow-right" className="size-4" />}
          </button>
          {isLast && def.kind !== "newsletter" && (
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <Icon name="lock" className="size-3.5" /> Your information is confidential and only seen by our legal team.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

function Note({ note }: { note: NoteDef }) {
  return note.style === "subheading" ? (
    <p className="mt-2 border-b border-line pb-2 text-xs font-semibold tracking-[0.16em] text-gold-700 uppercase sm:col-span-2">{note.text}</p>
  ) : (
    <p className="text-sm leading-relaxed text-ink-muted sm:col-span-2">{note.text}</p>
  );
}

function Field({
  field,
  formId,
  value,
  error,
  onChange,
  uploads,
  onFiles,
  onRemove,
}: {
  field: FieldDef;
  formId: string;
  value: string | string[] | undefined;
  error?: string;
  onChange: (v: string | string[]) => void;
  uploads: Upload[];
  onFiles: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const id = `${formId}-${field.id}`;
  const describedBy = [field.description ? `${id}-desc` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  const common = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, "aria-required": field.required || undefined };
  const span = field.width === "half" ? "" : "sm:col-span-2";
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) ? value : [];
  const label = (
    <>
      {field.label}
      {field.required ? <span className="text-gold-700"> *</span> : <span className="font-normal text-ink-muted"> (optional)</span>}
    </>
  );

  const help = (
    <>
      {field.description && (
        <p id={`${id}-desc`} className="mt-1.5 text-sm text-ink-muted">
          {field.description}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </>
  );

  if (field.type === "radio" || field.type === "checkbox") {
    return (
      <fieldset className={span} aria-describedby={describedBy}>
        <legend className="mb-2 text-[0.95rem] font-medium text-ink">{label}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {field.choices?.map((c, i) => {
            const checked = field.type === "radio" ? str === c : arr.includes(c);
            return (
              <label key={c} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[0.95rem] transition-colors ${checked ? "border-navy-700 bg-navy-50" : "border-line bg-white hover:border-navy-900/30"}`}>
                <input
                  type={field.type}
                  name={id}
                  {...(i === 0 ? { id } : {})}
                  checked={checked}
                  onChange={() => onChange(field.type === "radio" ? c : checked ? arr.filter((x) => x !== c) : [...arr, c])}
                  className="size-4 accent-navy-900"
                />
                {c}
              </label>
            );
          })}
        </div>
        {help}
      </fieldset>
    );
  }

  if (field.type === "consent") {
    return (
      <div className={span}>
        <label className="flex cursor-pointer items-start gap-3 text-[0.95rem]">
          <input type="checkbox" {...common} checked={str === "yes"} onChange={(e) => onChange(e.target.checked ? "yes" : "")} className="mt-1 size-4 accent-navy-900" />
          <span>{label}</span>
        </label>
        {help}
      </div>
    );
  }

  if (field.type === "file") {
    const active = uploads.filter((u) => u.status !== "error").length;
    return (
      <div className={span}>
        <span className="mb-2 block text-[0.95rem] font-medium text-ink">{label}</span>
        {active < (field.maxFiles ?? 1) && (
          <label htmlFor={id} className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors ${error ? "border-red-600" : "border-navy-900/25 hover:border-navy-700 hover:bg-navy-50/50"}`}>
            <Icon name="upload" className="size-6 text-navy-700" />
            <span className="font-medium text-navy-900">Choose file{(field.maxFiles ?? 1) > 1 ? "s" : ""} to upload</span>
            <span className="text-xs text-ink-muted">{field.accept?.join(", ").toUpperCase()} · up to 10 MB</span>
            <input
              id={id}
              type="file"
              className="sr-only"
              accept={field.accept?.join(",")}
              multiple={(field.maxFiles ?? 1) > 1}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              onChange={(e) => {
                if (e.target.files?.length) onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {uploads.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-warm px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Icon name="file-text" className="size-4 shrink-0 text-navy-700" />
                  <span className="truncate">{u.name}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{u.status === "uploading" ? "Uploading…" : u.status === "error" ? u.error : `${Math.max(1, Math.round(u.size / 1024))} KB`}</span>
                </span>
                {u.status !== "uploading" && (
                  <button type="button" onClick={() => onRemove(u.id)} className="shrink-0 rounded-full p-1 text-ink-muted hover:text-red-700">
                    <Icon name="x" className="size-4" label={`Remove ${u.name}`} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {help}
      </div>
    );
  }

  const autoComplete = field.role === "name" ? "name" : field.role === "email" ? "email" : field.role === "phone" ? "tel" : undefined;
  return (
    <div className={span}>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-medium text-ink">
        {label}
      </label>
      {field.type === "textarea" ? (
        <textarea {...common} rows={5} value={str} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      ) : field.type === "select" ? (
        <select {...common} value={str} onChange={(e) => onChange(e.target.value)} className={`${inputCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2320336d%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:1.1rem] bg-[right_1rem_center] bg-no-repeat pr-10`}>
          <option value="">Select…</option>
          {field.choices?.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === "tel" ? "tel" : field.type === "email" ? "email" : field.type === "date" ? "date" : field.type === "number" ? "text" : "text"}
          inputMode={field.type === "number" ? "decimal" : undefined}
          autoComplete={autoComplete}
          value={str}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
      {help}
    </div>
  );
}
