import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { FilterSelect, Flash, ListFilters, STATUS_OPTIONS, Table } from "@/components/admin/ContentList";
import { Badge, btn, Card, EmptyState, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Legal documents" };

const GROUPS = [
  { value: "corporate-filings", label: "Corporate filings" },
  { value: "agreements", label: "Agreements" },
];

export default async function DocumentsList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("documents.manage");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = ["published", "scheduled", "draft"].includes(sp.status ?? "") ? sp.status : undefined;
  const group = GROUPS.some((g) => g.value === sp.group) ? sp.group : undefined;
  const conds: (SQL | undefined)[] = [];
  if (q) conds.push(or(ilike(documents.title, `%${q}%`), ilike(documents.slug, `%${q}%`)));
  if (status) conds.push(eq(documents.status, status as "draft"));
  if (group) conds.push(eq(documents.group, group));
  const db = await getDb();
  const rows = await db
    .select({ id: documents.id, title: documents.title, slug: documents.slug, group: documents.group, formId: documents.formId, status: documents.status, updatedAt: documents.updatedAt })
    .from(documents)
    .where(and(...conds))
    .orderBy(asc(documents.group), asc(documents.sortOrder));
  return (
    <>
      <PageTitle
        title="Legal documents"
        description="Online questionnaire pages for filings and agreements."
        actions={
          <Link href="/admin/documents/new/" className={btn("primary")}>
            New document page
          </Link>
        }
      />
      <Flash params={sp} />
      <Card padded={false}>
        <ListFilters action="/admin/documents/" q={q}>
          <FilterSelect name="group" label="Group" value={group} options={GROUPS} />
          <FilterSelect name="status" label="Status" value={status} options={STATUS_OPTIONS} />
        </ListFilters>
        {rows.length ? (
          <Table head={["Page", "Group", "Questionnaire", "Status", "Updated"]}>
            {rows.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link href={`/admin/documents/${d.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                    {d.title}
                  </Link>
                  <span className="block text-xs text-slate-500">/{d.slug}/</span>
                </td>
                <td className="px-5 py-3 text-slate-600">{GROUPS.find((g) => g.value === d.group)?.label}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-600">{d.formId}</td>
                <td className="px-5 py-3">
                  <Badge value={d.status} />
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(d.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No document pages found" />
        )}
      </Card>
    </>
  );
}
