import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, ilike, or } from "drizzle-orm";
import { ImportRedirectsForm, RedirectForm } from "@/components/admin/RedirectForms";
import { Card, EmptyState, formatDateTime, PageTitle, Pager } from "@/components/admin/ui";
import { getDb } from "@/db";
import { redirects } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Redirects" };

const PER_PAGE = 50;

export default async function RedirectsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; deleted?: string }> }) {
  await requireUserPage("redirects.manage");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);
  const where = q ? or(ilike(redirects.source, `%${q}%`), ilike(redirects.destination, `%${q}%`), ilike(redirects.note, `%${q}%`)) : undefined;
  const db = await getDb();
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(redirects).where(where),
    db.select().from(redirects).where(where).orderBy(asc(redirects.source)).limit(PER_PAGE).offset((page - 1) * PER_PAGE),
  ]);
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  return (
    <>
      <PageTitle title="Redirects" description="Send visitors and search engines from old URLs to their new location. Use these when a page is renamed or removed." />
      {sp.deleted && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Redirect deleted.</p>}
      <Card title="Add a redirect" className="mb-6">
        <RedirectForm />
      </Card>
      <Card padded={false} className="mb-6">
        <form className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-4" role="search">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Search
            <input name="q" defaultValue={q} placeholder="Old or new URL" className="h-9 w-72 rounded-lg border border-slate-300 px-3 text-sm" />
          </label>
          <button type="submit" className="h-9 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white">
            Search
          </button>
          <span className="ml-auto text-sm text-slate-500">{n} redirect{n === 1 ? "" : "s"}</span>
        </form>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Old URL</th>
                  <th className="px-5 py-3 font-medium">New URL</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Hits</th>
                  <th className="px-5 py-3 font-medium">Last used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5 font-mono text-xs">
                      <Link href={`/admin/redirects/${r.id}/`} className="text-navy-700 hover:underline">
                        {r.source}
                      </Link>
                      {r.note && <span className="block font-sans text-xs text-slate-500">{r.note}</span>}
                    </td>
                    <td className="max-w-md truncate px-5 py-2.5 font-mono text-xs">{r.destination}</td>
                    <td className="px-5 py-2.5">{r.statusCode}</td>
                    <td className="px-5 py-2.5 text-slate-600">{r.hits}</td>
                    <td className="px-5 py-2.5 text-slate-600">{formatDateTime(r.lastHitAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={q ? "No redirects match" : "No redirects yet"} />
        )}
        <Pager page={page} pages={pages} href={(p) => `/admin/redirects/?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`} />
      </Card>
      <Card title="Bulk import">
        <ImportRedirectsForm />
      </Card>
    </>
  );
}
