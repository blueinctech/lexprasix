import type { Metadata } from "next";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { moveProduct } from "@/app/admin/_actions/products";
import { Flash, Table } from "@/components/admin/ContentList";
import { ActionForm, Badge, btn, Card, EmptyState, formatDateTime, PageTitle, SubmitButton } from "@/components/admin/ui";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Shop" };

export default async function ProductsList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("services.manage");
  const db = await getDb();
  const rows = await db
    .select({ id: products.id, title: products.title, slug: products.slug, priceLabel: products.priceLabel, buyUrl: products.buyUrl, status: products.status, updatedAt: products.updatedAt })
    .from(products)
    .orderBy(asc(products.sortOrder), asc(products.title));
  return (
    <>
      <PageTitle
        title="Shop"
        description="Products on /shop/, in this order. Without a buy link, a product page shows an order request form; requests arrive in Enquiries."
        actions={
          <Link href="/admin/products/new/" className={btn("primary")}>
            New product
          </Link>
        }
      />
      <Flash params={await searchParams} />
      {rows.length === 0 ? (
        <EmptyState title="No products yet" text="Add an eBook or other product to show it on /shop/." />
      ) : (
        <Card padded={false}>
          <Table head={["Order", "Product", "Price", "Checkout", "Status", "Updated"]}>
            {rows.map((p, i) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex gap-1">
                    <ActionForm action={moveProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="up" />
                      {i > 0 && (
                        <SubmitButton small variant="ghost" pendingLabel="…">
                          <span aria-label={`Move ${p.title} up`}>↑</span>
                        </SubmitButton>
                      )}
                    </ActionForm>
                    <ActionForm action={moveProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="down" />
                      {i < rows.length - 1 && (
                        <SubmitButton small variant="ghost" pendingLabel="…">
                          <span aria-label={`Move ${p.title} down`}>↓</span>
                        </SubmitButton>
                      )}
                    </ActionForm>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/admin/products/${p.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                    {p.title}
                  </Link>
                  <span className="block text-xs text-slate-500">/product/{p.slug}/</span>
                </td>
                <td className="px-5 py-3 text-slate-700">{p.priceLabel || <span className="text-amber-700">Not set (price on request)</span>}</td>
                <td className="px-5 py-3 text-slate-700">{p.buyUrl ? "Payment link" : "Order request form"}</td>
                <td className="px-5 py-3">
                  <Badge value={p.status} />
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
