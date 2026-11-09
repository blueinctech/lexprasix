import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/ContentList";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { Badge, PageTitle } from "@/components/admin/ui";
import { isUuid } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";
import { loadProduct } from "../load";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("services.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const product = await loadProduct(id);
  if (!product) notFound();
  return (
    <>
      <PageTitle title={product.title} description={<Badge value={product.status} />} back={{ href: "/admin/products/", label: "Shop" }} />
      <Flash params={await searchParams} />
      <ProductEditor product={product} />
    </>
  );
}
