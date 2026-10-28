import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { moveService } from "@/app/admin/_actions/services";
import { Flash, Table } from "@/components/admin/ContentList";
import { ActionForm, Badge, btn, Card, formatDateTime, PageTitle, SubmitButton } from "@/components/admin/ui";
import { getDb } from "@/db";
import { services } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("services.manage");
  const db = await getDb();
  const rows = await db
    .select({ id: services.id, title: services.title, shortTitle: services.shortTitle, slug: services.slug, status: services.status, updatedAt: services.updatedAt })
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.title));
  return (
    <>
      <PageTitle
        title="Services"
        description="Shown on the homepage and /service/ in this order."
        actions={
          <Link href="/admin/services/new/" className={btn("primary")}>
            New service
          </Link>
        }
      />
      <Flash params={await searchParams} />
      <Card padded={false}>
        <Table head={["Order", "Service", "Status", "Updated"]}>
          {rows.map((s, i) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="px-5 py-3">
                <div className="flex gap-1">
                  <ActionForm action={moveService}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="up" />
                    {i > 0 && (
                      <SubmitButton small variant="ghost" pendingLabel="…">
                        <span aria-label={`Move ${s.title} up`}>↑</span>
                      </SubmitButton>
                    )}
                  </ActionForm>
                  <ActionForm action={moveService}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="down" />
                    {i < rows.length - 1 && (
                      <SubmitButton small variant="ghost" pendingLabel="…">
                        <span aria-label={`Move ${s.title} down`}>↓</span>
                      </SubmitButton>
                    )}
                  </ActionForm>
                </div>
              </td>
              <td className="px-5 py-3">
                <Link href={`/admin/services/${s.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                  {s.shortTitle || s.title}
                </Link>
                <span className="block text-xs text-slate-500">/service/{s.slug}/</span>
              </td>
              <td className="px-5 py-3">
                <Badge value={s.status} />
              </td>
              <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(s.updatedAt)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
