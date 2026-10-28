import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { FilterSelect, Flash, ListFilters, STATUS_OPTIONS, Table } from "@/components/admin/ContentList";
import { Badge, btn, Card, EmptyState, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { pages } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Pages" };

const TEMPLATE_LABEL: Record<string, string> = { home: "Homepage", index: "Listing", default: "Standard", landing: "Landing", legal: "Legal", contact: "Contact", booking: "Booking", reviews: "Reviews" };

export default async function PagesList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("pages.manage");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = ["published", "scheduled", "draft"].includes(sp.status ?? "") ? sp.status : undefined;
  const conds: (SQL | undefined)[] = [];
  if (q) conds.push(or(ilike(pages.title, `%${q}%`), ilike(pages.path, `%${q}%`)));
  if (status) conds.push(eq(pages.status, status as "draft"));
  const db = await getDb();
  // Few pages: no pagination needed.
  const rows = await db
    .select({ id: pages.id, title: pages.title, path: pages.path, template: pages.template, status: pages.status, updatedAt: pages.updatedAt })
    .from(pages)
    .where(and(...conds))
    .orderBy(asc(pages.path));
  return (
    <>
      <PageTitle
        title="Pages"
        description="Core pages of the website. Services, legal documents and articles have their own sections."
        actions={
          <Link href="/admin/pages/new/" className={btn("primary")}>
            New page
          </Link>
        }
      />
      <Flash params={sp} />
      <Card padded={false}>
        <ListFilters action="/admin/pages/" q={q}>
          <FilterSelect name="status" label="Status" value={status} options={STATUS_OPTIONS} />
        </ListFilters>
        {rows.length ? (
          <Table head={["Title", "URL", "Type", "Status", "Updated"]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/admin/pages/${p.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                    {p.title}
                  </Link>
                </td>
                <td className="px-5 py-3 text-slate-600">{p.path ? `/${p.path}/` : "/"}</td>
                <td className="px-5 py-3 text-slate-600">{TEMPLATE_LABEL[p.template] ?? p.template}</td>
                <td className="px-5 py-3">
                  <Badge value={p.status} />
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No pages found" />
        )}
      </Card>
    </>
  );
}
