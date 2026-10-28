import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DeleteForm, NoteForm, StatusForm } from "@/components/admin/SubmissionForms";
import { Badge, Card, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { emailOutbox, submissionFiles, submissionNotes, submissions, users } from "@/db/schema";
import { getFormDefinition } from "@/forms/registry";
import { fieldsOf } from "@/forms/types";
import { audit } from "@/lib/audit";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Enquiry", referrer: "no-referrer" };

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage("submissions.view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [sub] = await db.select().from(submissions).where(eq(submissions.id, id));
  if (!sub) notFound();

  // Opening an enquiry marks it read and is recorded (confidential data access).
  if (!sub.readAt) await db.update(submissions).set({ readAt: new Date() }).where(eq(submissions.id, id));
  await audit({ userId: user.id, action: "submission.view", entityType: "submission", entityId: id });

  const [files, notes, emails, staff] = await Promise.all([
    db.select().from(submissionFiles).where(eq(submissionFiles.submissionId, id)).orderBy(asc(submissionFiles.createdAt)),
    db.select({ id: submissionNotes.id, body: submissionNotes.body, createdAt: submissionNotes.createdAt, who: users.name }).from(submissionNotes).leftJoin(users, eq(users.id, submissionNotes.userId)).where(eq(submissionNotes.submissionId, id)).orderBy(desc(submissionNotes.createdAt)),
    db.select({ template: emailOutbox.template, to: emailOutbox.to, status: emailOutbox.status, attempts: emailOutbox.attempts, lastError: emailOutbox.lastError, sentAt: emailOutbox.sentAt }).from(emailOutbox).where(eq(emailOutbox.submissionId, id)),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
  ]);

  const def = getFormDefinition(sub.formId);
  const data = sub.data as Record<string, string | string[]>;
  const fileById = new Map(files.map((f) => [f.id, f]));
  // Answers in questionnaire order, grouped by step; unknown keys (older form versions) at the end.
  const known = new Set<string>();
  const sections = (def?.steps ?? []).map((step) => ({
    title: step.title,
    rows: step.items
      .filter((i) => i.kind === "field")
      .map((f) => {
        if (f.kind !== "field") return null;
        known.add(f.id);
        const v = data[f.id];
        return { id: f.id, label: f.label, type: f.type, value: v };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r) && r!.value !== undefined && r!.value !== "" && !(Array.isArray(r!.value) && !r!.value.length)),
  }));
  const extra = Object.entries(data).filter(([k]) => !known.has(k));
  const totalFields = def ? fieldsOf(def).length : Object.keys(data).length;

  return (
    <>
      <PageTitle
        back={{ href: "/admin/submissions/", label: "All enquiries" }}
        title={sub.name || sub.email || "Enquiry"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{sub.reference}</span> · {sub.formTitle} · received {formatDateTime(sub.createdAt)} <Badge value={sub.status} />
          </span>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-6">
          <Card title="Contact">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Name</dt>
                <dd className="font-medium">{sub.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd>{sub.email ? <a className="text-navy-700 hover:underline" href={`mailto:${sub.email}?subject=${encodeURIComponent(`Your ${sub.formTitle} request (${sub.reference})`)}`}>{sub.email}</a> : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd>{sub.phone ? <a className="text-navy-700 hover:underline" href={`tel:${sub.phone.replace(/\s+/g, "")}`}>{sub.phone}</a> : "—"}</dd>
              </div>
            </dl>
          </Card>

          <Card title={`Answers (${Object.keys(data).length} of ${totalFields} fields completed)`} padded={false}>
            {sections
              .filter((s) => s.rows.length)
              .map((s) => (
                <section key={s.title} className="border-b border-slate-100 last:border-0">
                  {sections.length > 1 && <h3 className="bg-slate-50 px-5 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">{s.title}</h3>}
                  <dl className="divide-y divide-slate-100">
                    {s.rows.map((r) => (
                      <div key={r.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
                        <dt className="text-slate-500">{r.label}</dt>
                        <dd className="break-words whitespace-pre-wrap text-slate-900">
                          {r.type === "file"
                            ? (r.value as string[]).map((fid) => {
                                const f = fileById.get(fid);
                                return f ? (
                                  <a key={fid} href={`/admin/submissions/${id}/file/${fid}/`} className="mr-3 inline-flex items-center gap-1 text-navy-700 hover:underline">
                                    {f.filename}
                                  </a>
                                ) : (
                                  <span key={fid}>(file missing)</span>
                                );
                              })
                            : Array.isArray(r.value)
                              ? r.value.join(", ")
                              : r.value === "yes" && r.type === "consent"
                                ? "Yes"
                                : r.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            {extra.length > 0 && (
              <dl className="divide-y divide-slate-100 border-t border-slate-100">
                {extra.map(([k, v]) => (
                  <div key={k} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
                    <dt className="font-mono text-xs text-slate-500">{k}</dt>
                    <dd className="whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {files.length > 0 && (
            <Card title={`Uploaded files (${files.length})`}>
              <ul className="grid gap-2 text-sm">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="truncate">{f.filename}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                      {Math.max(1, Math.round(f.size / 1024))} KB
                      <a href={`/admin/submissions/${id}/file/${f.id}/`} className="font-medium text-navy-700 hover:underline">
                        Download
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">Files are stored privately. Download links expire after 5 minutes and every download is logged.</p>
            </Card>
          )}
        </div>

        <aside className="grid content-start gap-6">
          {can(user.role, "submissions.manage") && (
            <Card title="Handling">
              <StatusForm id={id} status={sub.status} assignedToId={sub.assignedToId} staff={staff} />
            </Card>
          )}
          <Card title="Internal notes">
            {can(user.role, "submissions.manage") && <NoteForm id={id} />}
            <ul className="mt-4 grid gap-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-amber-50/60 p-3 text-sm">
                  <p className="whitespace-pre-wrap text-slate-900">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {n.who ?? "Former user"} · {formatDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
              {!notes.length && <li className="text-sm text-slate-500">No notes yet.</li>}
            </ul>
          </Card>
          <Card title="Emails">
            <ul className="grid gap-2 text-sm">
              {emails.map((e) => (
                <li key={e.template} className="flex items-start justify-between gap-3">
                  <span>
                    <span className="block">{e.template === "submission.staff" ? "Staff notification" : "Client confirmation"}</span>
                    <span className="block text-xs text-slate-500">{e.to.join(", ")}</span>
                    {e.lastError && <span className="block text-xs text-red-700">{e.lastError}</span>}
                  </span>
                  <Badge value={e.status} />
                </li>
              ))}
              {!emails.length && <li className="text-slate-500">{sub.status === "spam" ? "Not emailed (marked as spam)." : "No emails for this form."}</li>}
            </ul>
          </Card>
          <Card title="Details">
            <dl className="grid gap-2 text-xs text-slate-600">
              <div>Page: {sub.meta.pagePath ?? "—"}</div>
              {sub.meta.utm && Object.keys(sub.meta.utm).length > 0 && <div>Campaign: {Object.entries(sub.meta.utm).map(([k, v]) => `${k}=${v}`).join(", ")}</div>}
              {sub.consent && <div>Consent: “{sub.consent.text}” at {formatDateTime(sub.consent.at)}</div>}
              <div>First opened: {formatDateTime(sub.readAt ?? new Date())}</div>
            </dl>
          </Card>
          {can(user.role, "submissions.delete") && (
            <Card title="Delete">
              <DeleteForm id={id} />
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
