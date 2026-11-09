import Image from "next/image";
import Link from "next/link";
import type { getProduct, ImageInfo } from "@/lib/content/queries";
import { getSettings, resolveMediaInHtml } from "@/lib/content/queries";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { breadcrumbNode, graph, organizationNode, productNode, webPageNode, websiteNode } from "@/lib/seo";
import { getFormDefinition } from "@/forms/registry";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container } from "@/components/ui/primitives";
import { JsonLd, PageHeader, Prose } from "./common";

// The shop: the firm's ebooks. There is no cart; each product either links to
// an external payment page or shows an order request form (Admin → Shop).

type Product = NonNullable<Awaited<ReturnType<typeof getProduct>>>;

export const PRICE_ON_REQUEST = "Price on request";

function Cover({ image, title, sizes, priority = false }: { image: ImageInfo | null; title: string; sizes: string; priority?: boolean }) {
  return image ? (
    <Image src={image.url} alt={image.alt || title} fill sizes={sizes} priority={priority} className="object-contain p-6" />
  ) : (
    <div className="grid h-full place-items-center text-navy-700">
      <Icon name="file-text" className="size-14" />
    </div>
  );
}

/** Shop grid card: cover on a light band, Lora title, format and price, gold base line like the service cards. */
export function ProductCard({ product, priority = false }: { product: { slug: string; title: string; summary: string; priceLabel: string; format: string; image: ImageInfo | null }; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.25rem] border-b-[6px] border-gold-500 bg-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.12)] transition-transform duration-300 hover:-translate-y-1">
      <div className="relative aspect-[4/3] bg-paper-warm">
        <Cover image={product.image} title={product.title} sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" priority={priority} />
      </div>
      <div className="flex flex-1 flex-col px-8 pt-7 pb-8">
        {product.format && <p className="text-[0.875rem] font-medium tracking-wide text-gold-500 uppercase">{product.format}</p>}
        <h2 className="mt-2 text-2xl leading-[1.42] font-semibold text-heading">
          <Link href={`/product/${product.slug}/`} className="after:absolute after:inset-0 group-hover:text-gold-500">
            {product.title}
          </Link>
        </h2>
        {product.summary && <p className="mt-3 line-clamp-3 flex-1 leading-[1.75] text-ink">{product.summary}</p>}
        <div className="mt-6 flex items-center justify-between gap-4">
          <span className="font-display text-xl font-semibold text-navy-700">{product.priceLabel || PRICE_ON_REQUEST}</span>
          <span className="inline-flex items-center gap-2 text-[0.875rem] font-medium text-heading group-hover:text-gold-500">
            View details <Icon name="arrow-right" className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

export async function ProductView({ product }: { product: Product }) {
  const settings = await getSettings();
  const path = `/product/${product.slug}/`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop/" },
    { name: product.title, path },
  ];
  const description = product.seo.description || product.summary;
  const hasBuyLink = /^https:\/\//.test(product.buyUrl);
  const orderForm = hasBuyLink ? null : getFormDefinition("ebook-order");
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title: product.seo.title || product.title, description, image: product.featuredImage, hasBreadcrumb: true }),
          productNode({
            path,
            name: product.title,
            description,
            image: product.featuredImage,
            format: product.format,
            price: product.priceLabel && product.priceAmount ? { amount: product.priceAmount, currency: product.priceCurrency } : null,
            buyUrl: hasBuyLink ? product.buyUrl : undefined,
          }),
          breadcrumbNode(path, crumbs),
          websiteNode(settings),
          organizationNode(settings),
        )}
      />
      <PageHeader crumbs={crumbs} title={product.title} />
      <Container className="grid items-start gap-12 py-20 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16 lg:py-[7.5rem]">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-paper-warm">
          <Cover image={product.featuredImage} title={product.title} sizes="(min-width: 1024px) 416px, 100vw" priority />
        </div>
        <div className="min-w-0">
          {product.format && <p className="font-display text-xl font-medium text-gold-500">{product.format}</p>}
          <p className="mt-3 font-display text-[2rem] leading-tight font-semibold text-navy-700" data-testid="product-price">
            {product.priceLabel || PRICE_ON_REQUEST}
          </p>
          {product.summary && <p className="mt-5 text-lg leading-[1.75] text-ink">{product.summary}</p>}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {hasBuyLink ? (
              <ButtonLink href={product.buyUrl} arrow>
                {product.buyLabel || "Buy now"}
              </ButtonLink>
            ) : (
              <ButtonLink href="#order" arrow>
                Order this eBook
              </ButtonLink>
            )}
            <Link href="/contact-us/" className="text-[0.875rem] font-medium text-heading underline-offset-4 hover:text-gold-500 hover:underline">
              Questions? Contact us
            </Link>
          </div>
          {hasBuyLink && <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted"><Icon name="lock" className="size-3.5" /> Payment is taken securely on our payment provider&apos;s page.</p>}
          {product.body && <Prose html={resolveMediaInHtml(sanitizeRichHtml(product.body))} className="mt-12 border-t border-[#e6e6e6] pt-10" />}
        </div>
      </Container>
      {orderForm && (
        <section id="order" className="scroll-mt-28 pb-20 lg:pb-[7.5rem]">
          <Container>
            <div className="rounded-[2.5rem] border border-[#8a8a8a]/60 bg-[#f7f7f7] px-5 py-10 sm:px-14 sm:py-14">
              <h2 className="text-[1.6rem] leading-[1.3] text-[#000080] sm:text-[1.75rem]">Order this eBook</h2>
              <p className="mt-3 max-w-3xl text-ink">Send us your details and we will email you {product.priceLabel ? "" : "the price and "}payment details. The eBook is sent to your email address once payment is confirmed.</p>
              <div className="mt-10">
                <FormRenderer def={orderForm} initialValues={{ product: product.title }} />
              </div>
            </div>
          </Container>
        </section>
      )}
    </>
  );
}
