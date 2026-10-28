import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Badge, btn, Card, EmptyState, formatDateTime, PageTitle, Pager } from "@/components/admin/ui";
import { BulkBar } from "@/components/admin/SubmissionForms";
import { getDb } from "@/db";
import { submissionStatus, users } from "@/db/schema";
import { inboxFormCounts, listInbox, type InboxFilter } from "@/lib/admin/submissions";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Enquiries" };

type Search = Record<string, string | undefined>;

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUserPage("submissions.view");
  const sp = await searchParams;
  const filter: InboxFilter = { q: sp.q, status: sp.status, form: sp.form, from: sp.from, to: sp.to, assigned: sp.assigned };
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const db = await getDb();
  const [{ rows, total, pages }, forms, staff] = await Promise.all([
    listInbox(filter, page, user.id),
    inboxFormCounts(),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));
  const qs = (patch: Search) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return `/admin/submissions/${s ? `?${s}` : ""}`;
  };
  const exportHref = `/admin/submissions/export/?${new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]).toString()}`;

  return (
    <>
      <PageTitle
        title="Enquiries"
        description={`${total} enquir${total === 1 ? "y" : "ies"}${filter.status === "spam" ? " in spam" : ""}. Client information is confidential.`}
        actions={
          can(user.role, "submissions.export") ? (
            <a href={exportHref} className={btn("secondary")}>
              Export CSV
            </a>
          ) : undefined
        }
      />
      {sp.deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Enquiry deleted.</p>}

      <form className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Search name, email, reference, answers…" className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2" aria-label="Search enquiries" />
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Status">
          <option value="">All statuses (no spam)</option>
          {submissionStatus.enumValues.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select name="form" defaultValue={sp.form ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Form">
          <option value="">All forms</option>
          {forms.map((f) => (
            <option key={f.formId} value={f.formId}>
              {f.formTitle} ({f.n})
            </option>
          ))}
        </select>
        <select name="assigned" defaultValue={sp.assigned ?? ""} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Assigned to">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className={btn("primary")} type="submit">
            Filter
          </button>
          <Link href="/admin/submissions/" className={btn("ghost")}>
            Reset
          </Link>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          From <input type="date" name="from" defaultValue={sp.from} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          To <input type="date" name="to" defaultValue={sp.to} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
      </form>

      <Card padded={false}>
        {rows.length ? (
          <BulkBar canManage={can(user.role, "submissions.manage")}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="w-8 px-4 py-2.5">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-2.5 font-medium">Client</th>
                    <th className="px-4 py-2.5 font-medium">Request</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Assigned</th>
                    <th className="px-4 py-2.5 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.status === "new" ? "bg-blue-50/30" : ""}>
                      <td className="px-4 py-3">
                        <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.reference}`} className="size-4 accent-navy-900" />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/submissions/${r.id}/`} className={`block hover:underline ${r.status === "new" ? "font-semibold" : "font-medium"} text-slate-900`}>
                          {r.name || r.email || "(no name)"}
                        </Link>
                        <span className="text-xs text-slate-500">{[r.email, r.phone].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-slate-800">{r.formTitle}</span>
                        <span className="font-mono text-xs text-slate-500">
                          {r.reference}
                          {r.files ? ` · ${r.files} file${r.files === 1 ? "" : "s"}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge value={r.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.assignedToId ? (staffName.get(r.assignedToId) ?? "—") : "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkBar>
        ) : (
          <EmptyState title="No enquiries match" text="Try a different filter, or check the spam folder." action={<Link className={btn("secondary", true)} href={qs({ status: "spam", page: undefined })}>View spam</Link>} />
        )}
        <Pager page={page} pages={pages} href={(n) => qs({ page: String(n) })} />
      </Card>
    </>
  );
}
