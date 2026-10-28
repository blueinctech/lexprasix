"use client";

import { useActionState, type ReactNode } from "react";
import { addNote, bulkUpdate, deleteSubmission, updateSubmission } from "@/app/admin/_actions/submissions";
import { IDLE } from "@/lib/admin/types";
import { ActionForm, ActionMessage, Select, SubmitButton, TextArea, TextInput } from "./ui";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "awaiting_client", label: "Awaiting client" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "spam", label: "Spam" },
];

/** Wraps the inbox table in a form so selected rows can be updated together. */
export function BulkBar({ children, canManage }: { children: ReactNode; canManage: boolean }) {
  const [state, action] = useActionState(bulkUpdate, IDLE);
  if (!canManage) return <>{children}</>;
  return (
    <form action={action}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-sm">
        <span className="text-slate-500">With selected:</span>
        <select name="status" defaultValue="" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" aria-label="New status">
          <option value="" disabled>
            Set status…
          </option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <SubmitButton small variant="secondary" pendingLabel="Updating…">
          Apply
        </SubmitButton>
        <div className="ml-auto">
          <ActionMessage state={state} />
        </div>
      </div>
      {children}
    </form>
  );
}

export function StatusForm({ id, status, assignedToId, staff }: { id: string; status: string; assignedToId: string | null; staff: { id: string; name: string }[] }) {
  return (
    <ActionForm action={updateSubmission}>
      <input type="hidden" name="id" value={id} />
      <Select label="Status" name="status" defaultValue={status} options={STATUS_OPTIONS} />
      <Select label="Assigned to" name="assignedToId" defaultValue={assignedToId ?? ""} options={[{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
  );
}

export function NoteForm({ id }: { id: string }) {
  return (
    <ActionForm action={addNote} resetOnSuccess>
      <input type="hidden" name="id" value={id} />
      <TextArea label="Add an internal note" name="body" rows={3} placeholder="Visible to staff only" />
      <SubmitButton small>Add note</SubmitButton>
    </ActionForm>
  );
}

export function DeleteForm({ id }: { id: string }) {
  return (
    <ActionForm action={deleteSubmission}>
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-slate-600">Permanently deletes this enquiry, its notes and uploaded files. Use for data-protection requests or after the retention period. This cannot be undone.</p>
      <TextInput label='Type "DELETE" to confirm' name="confirm" autoComplete="off" />
      <SubmitButton variant="danger" pendingLabel="Deleting…">
        Delete permanently
      </SubmitButton>
    </ActionForm>
  );
}
