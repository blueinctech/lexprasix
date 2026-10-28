import { restoreRevision } from "@/app/admin/_actions/revisions";
import { listRevisions, type RevisionEntity } from "@/lib/admin/revisions";
import { ActionForm, Card, formatDateTime, SubmitButton } from "./ui";

/** Earlier versions of a record with a restore button for each. */
export async function RevisionsList({ type, id, canRestore = true }: { type: RevisionEntity; id: string; canRestore?: boolean }) {
  const rows = await listRevisions(type, id);
  return (
    <Card title={`Earlier versions (${rows.length})`}>
      {rows.length ? (
        <ul className="grid gap-2 text-sm">
          {rows.slice(0, 10).map((r) => {
            const snap = r.snapshot as { title?: string; status?: string; deleted?: boolean };
            return (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-slate-800">{snap.title ?? "Untitled"}</span>
                  <span className="block text-xs text-slate-500">
                    {formatDateTime(r.createdAt)} · {r.by ?? "Import"}
                  </span>
                </span>
                {canRestore && !snap.deleted && (
                  <ActionForm action={restoreRevision} className="shrink-0">
                    <input type="hidden" name="revisionId" value={r.id} />
                    <SubmitButton small variant="secondary" pendingLabel="…" confirm="Replace the current content with this version? The current version is kept in this list.">
                      Restore
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Versions appear here each time you save.</p>
      )}
    </Card>
  );
}
