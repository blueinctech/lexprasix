import type { Metadata } from "next";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "New product" };

export default async function NewProduct() {
  await requireUserPage("services.manage");
  return (
    <>
      <PageTitle title="New product" back={{ href: "/admin/products/", label: "Shop" }} />
      <ProductEditor
        product={{
          id: null, title: "", slug: "", summary: "", body: "", priceLabel: "", priceAmount: "", priceCurrency: "NGN", format: "eBook (PDF)", buyUrl: "", buyLabel: "Buy now",
          status: "draft", publishedAtInput: "", featuredImage: null, ogImage: null, seo: {},
        }}
      />
    </>
  );
}
