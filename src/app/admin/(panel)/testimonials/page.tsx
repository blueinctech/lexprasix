import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { moveTestimonial } from "@/app/admin/_actions/testimonials";
import { Flash, Table } from "@/components/admin/ContentList";
import { ActionForm, Badge, btn, Card, EmptyState, PageTitle, SubmitButton } from "@/components/admin/ui";
import { getDb } from "@/db";
import { testimonials } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("pages.manage");
  const db = await getDb();
  const rows = await db.select().from(testimonials).orderBy(asc(testimonials.sortOrder));
  return (
    <>
      <PageTitle
        title="Testimonials"
        description="Only publish genuine statements the client agreed to share. Shown on the homepage, About and Reviews pages in this order."
        actions={
          <Link href="/admin/testimonials/new/" className={btn("primary")}>
            New testimonial
          </Link>
        }
      />
      <Flash params={await searchParams} />
      <Card padded={false}>
        {rows.length ? (
          <Table head={["Order", "Client", "Testimonial", "Source", "Status"]}>
            {rows.map((t, i) => (
              <tr key={t.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    {i > 0 && (
                      <ActionForm action={moveTestimonial}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="dir" value="up" />
                        <SubmitButton small variant="ghost" pendingLabel="…">
                          <span aria-label={`Move ${t.name} up`}>↑</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                    {i < rows.length - 1 && (
                      <ActionForm action={moveTestimonial}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="dir" value="down" />
                        <SubmitButton small variant="ghost" pendingLabel="…">
                          <span aria-label={`Move ${t.name} down`}>↓</span>
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/admin/testimonials/${t.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                    {t.name}
                  </Link>
                  {t.role && <span className="block text-xs text-slate-500">{t.role}</span>}
                </td>
                <td className="max-w-md px-5 py-3 text-slate-600">
                  <span className="line-clamp-2">{t.quote}</span>
                </td>
                <td className="px-5 py-3 text-slate-600 capitalize">{t.source}</td>
                <td className="px-5 py-3">
                  <Badge value={t.status} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No testimonials yet" />
        )}
      </Card>
    </>
  );
}
