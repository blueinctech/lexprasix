import type { Metadata } from "next";
import { Blocks } from "@/components/blocks/Blocks";
import { JsonLd, PageHeader } from "@/components/content/common";
import { ProductCard } from "@/components/content/shop";
import { Container } from "@/components/ui/primitives";
import type { AnyBlock } from "@/lib/blocks";
import { getPageByPath, getSettings, listProducts } from "@/lib/content/queries";
import { breadcrumbNode, buildMetadata, graph, organizationNode, webPageNode, websiteNode } from "@/lib/seo";

// The shop index (the old WooCommerce /shop/). Its title, intro and SEO are the
// "shop" page in Admin → Pages; the products are managed in Admin → Shop.

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPageByPath("shop")]);
  return buildMetadata({ settings, path: "/shop/", title: page?.title ?? "Shop", description: page?.summary, seo: page?.seo });
}

export default async function ShopIndex() {
  const [settings, page, products] = await Promise.all([getSettings(), getPageByPath("shop"), listProducts()]);
  const title = page?.title ?? "Shop";
  const crumbs = [{ name: "Home", path: "/" }, { name: title, path: "/shop/" }];
  return (
    <>
      <JsonLd data={graph(webPageNode({ path: "/shop/", title, description: page?.summary, type: ["WebPage", "CollectionPage"], hasBreadcrumb: true }), breadcrumbNode("/shop/", crumbs), websiteNode(settings), organizationNode(settings))} />
      <PageHeader crumbs={crumbs} title={title} />
      <section className="py-20 lg:py-[7.5rem]">
        <Container>
          {page?.summary && <p className="mx-auto mb-14 max-w-3xl text-center text-lg leading-[1.75] text-ink">{page.summary}</p>}
          {products.length ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p, i) => (
                <ProductCard key={p.slug} product={p} priority={i < 3} />
              ))}
            </div>
          ) : (
            <p className="text-center text-ink">There are no products in the shop right now. Please check back soon.</p>
          )}
        </Container>
      </section>
      {page && <Blocks blocks={page.blocks as AnyBlock[]} template={page.template} />}
    </>
  );
}
