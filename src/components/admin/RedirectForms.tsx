"use client";

import { deleteRedirect, importRedirects, saveRedirect } from "@/app/admin/_actions/redirects";
import { ActionForm, Select, SubmitButton, TextArea, TextInput } from "./ui";

const CODES = [
  { value: "301", label: "301 — Moved permanently (recommended)" },
  { value: "308", label: "308 — Permanent (keeps method)" },
  { value: "302", label: "302 — Temporary" },
  { value: "307", label: "307 — Temporary (keeps method)" },
];

export function RedirectForm({ value }: { value?: { id: string; source: string; destination: string; statusCode: number; note: string } }) {
  return (
    <ActionForm action={saveRedirect} resetOnSuccess={!value}>
      {value && <input type="hidden" name="id" value={value.id} />}
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_16rem]">
        <TextInput label="Old URL" name="source" defaultValue={value?.source} required placeholder="/old-page/" hint="Path on this site. Case and trailing slash don't matter." />
        <TextInput label="New URL" name="destination" defaultValue={value?.destination} required placeholder="/new-page/ or https://…" />
        <Select label="Type" name="statusCode" defaultValue={String(value?.statusCode ?? 301)} options={CODES} />
        <TextInput label="Note (optional)" name="note" defaultValue={value?.note} maxLength={200} className="md:col-span-3" />
      </div>
      <div>
        <SubmitButton>{value ? "Save redirect" : "Add redirect"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteRedirectForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteRedirect}>
      <input type="hidden" name="id" value={id} />
      <div>
        <SubmitButton variant="danger" confirm="Delete this redirect? Visitors to the old URL will get a 404.">
          Delete redirect
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ImportRedirectsForm() {
  return (
    <ActionForm action={importRedirects}>
      <TextArea label="Redirects (CSV)" name="csv" rows={6} required placeholder={"old,new,code\n/old-page/,/new-page/,301"} hint="One per line: old URL, new URL and optionally the status code (default 301). A header line is ignored. Existing redirects for the same old URL are updated." className="font-mono" />
      <div>
        <SubmitButton pendingLabel="Importing…">Import</SubmitButton>
      </div>
    </ActionForm>
  );
}
