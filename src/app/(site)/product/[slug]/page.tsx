import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/content/shop";
import { getProduct, getSettings, listProducts } from "@/lib/content/queries";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const params = (await listProducts()).map((p) => ({ slug: p.slug }));
  // At least one entry so the route can be prerendered; unknown slugs 404 at request time.
  return params.length ? params : [{ slug: "none" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, product] = await Promise.all([getSettings(), getProduct(slug)]);
  if (!product) return {};
  return buildMetadata({ settings, path: `/product/${slug}/`, title: product.title, description: product.summary, seo: product.seo, image: product.ogImage ?? product.featuredImage });
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  return <ProductView product={product} />;
}
