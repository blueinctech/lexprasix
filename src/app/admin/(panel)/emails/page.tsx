import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { RetryEmailButton } from "@/components/admin/SystemForms";
import { Badge, Card, EmptyState, formatDateTime, PageTitle, Pager } from "@/components/admin/ui";
import { getDb } from "@/db";
import { emailOutbox, emailStatus } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { emailProvider } from "@/lib/email/provider";

export const metadata: Metadata = { title: "Email log" };

const PAGE = 40;

// Delivery status of every email the site sends. "Sent" means the provider
// accepted it (with its message id); bounces are visible in the provider dashboard.
export default async function EmailsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireUserPage("email.view");
  const sp = await searchParams;
  const status = (emailStatus.enumValues as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof emailStatus.enumValues)[number]) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await getDb();
  const where = status ? eq(emailOutbox.status, status) : undefined;
  const [[{ n }], rows, byStatus] = await Promise.all([
    db.select({ n: count() }).from(emailOutbox).where(where),
    db.select().from(emailOutbox).where(where).orderBy(desc(emailOutbox.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ status: emailOutbox.status, n: count() }).from(emailOutbox).groupBy(emailOutbox.status),
  ]);
  const configured = emailProvider();
  const provider = configured === "ses" ? `Amazon SES (${process.env.SES_REGION})` : configured === "resend" ? "Resend" : process.env.NODE_ENV === "production" ? "NOT CONFIGURED" : "development (written to .data/mail)";

  return (
    <>
      <PageTitle title="Email log" description={`Transactional email provider: ${provider}. Failed emails retry automatically with back-off; you can also retry manually.`} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/emails/" className={`rounded-full px-3 py-1 ${!status ? "bg-navy-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>
          All
        </Link>
        {byStatus.map((s) => (
          <Link key={s.status} href={`/admin/emails/?status=${s.status}`} className={`rounded-full px-3 py-1 ${status === s.status ? "bg-navy-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>
            {s.status} ({s.n})
          </Link>
        ))}
      </div>
      <Card padded={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Subject</th>
                  <th className="px-4 py-2.5 font-medium">To</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Attempts</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="max-w-md px-4 py-3">
                      <span className="block truncate">{e.subject}</span>
                      {e.lastError && <span className="block text-xs text-red-700">{e.lastError}</span>}
                      {e.submissionId && (
                        <Link href={`/admin/submissions/${e.submissionId}/`} className="text-xs text-navy-700 hover:underline">
                          View enquiry
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.to.join(", ")}</td>
                    <td className="px-4 py-3">
                      <Badge value={e.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.attempts}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDateTime(e.createdAt)}</td>
                    <td className="px-4 py-3 text-right">{e.status === "failed" && <RetryEmailButton id={e.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No emails" />
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil(n / PAGE))} href={(p) => `/admin/emails/?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />
      </Card>
    </>
  );
}
