import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AnyBlock, BlockOf } from "@/lib/blocks";
import { getImage, getSettings, latestPosts, listDocuments, listServices, listTestimonials, resolveMediaInHtml } from "@/lib/content/queries";
import { mediaBaseUrl } from "@/lib/env";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { getFormDefinition } from "@/forms/registry";
import { Carousel } from "@/components/ui/Carousel";
import { CountUp } from "@/components/ui/CountUp";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, Eyebrow, SectionHeading } from "@/components/ui/primitives";
import { DocumentCard, PostCard, Prose, ServiceCard } from "@/components/content/common";
import { CalendlyEmbed, ConsentEmbed, TrustindexWidget } from "./Embeds";

// Page sections, styled after the WordPress (Ensaf) theme the site replicates.
// Every block's text, links and images come from the CMS (Admin → Pages).

export async function Blocks({ blocks, h1Title, template }: { blocks: AnyBlock[]; h1Title?: string; template?: string }) {
  // The first hero carries the page H1 (exactly one per page).
  const h1Index = h1Title ? blocks.findIndex((b) => b.type === "hero") : -1;
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={block.id} block={block} asH1={i === h1Index} template={template} />
      ))}
    </>
  );
}

/** Media paths stored in blocks: uploads go through the media host, theme files are served by the site. */
export function imageUrl(src: string | undefined | null): string | null {
  if (!src) return null;
  if (src.startsWith("/wp-content/uploads/")) return `${mediaBaseUrl()}${src}`;
  return src;
}

function Block({ block, asH1, template }: { block: AnyBlock; asH1: boolean; template?: string }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} asH1={asH1} />;
    case "intro":
      return <IntroBlock block={block} />;
    case "split":
      return <SplitBlock block={block} />;
    case "logos":
      return <LogosBlock block={block} />;
    case "richText":
      return (
        <section className="py-16 sm:py-24">
          <Container size="narrow">
            {block.heading && <h2 className="mb-8 text-3xl sm:text-4xl">{block.heading}</h2>}
            <Prose html={resolveMediaInHtml(sanitizeRichHtml(block.html))} />
          </Container>
        </section>
      );
    case "services":
      return <ServicesBlock block={block} />;
    case "steps":
      return <StepsBlock block={block} />;
    case "features":
      return <FeaturesBlock block={block} />;
    case "stats":
      return <StatsBlock block={block} />;
    case "documents":
      return <DocumentsBlock block={block} />;
    case "latestPosts":
      return <LatestPostsBlock block={block} />;
    case "faq":
      return <FaqBlock block={block} />;
    case "cta":
      return <CtaBlock block={block} />;
    case "quote":
      return (
        <section className="py-16">
          <Container size="narrow">
            <figure className="text-center">
              <Icon name="quote" className="mx-auto size-10 text-gold-500" />
              <blockquote className="mt-6 font-display text-2xl leading-snug text-heading sm:text-3xl">{block.text}</blockquote>
              {block.attribution && <figcaption className="mt-6 text-sm text-ink-muted">— {block.attribution}</figcaption>}
            </figure>
          </Container>
        </section>
      );
    case "offices":
      return <OfficesBlock block={block} />;
    case "contactForm":
      return <ContactFormBlock block={block} />;
    case "calendly":
      return <CalendlyBlock block={block} />;
    case "reviews":
      return <ReviewsBlock block={block} fullPage={template === "reviews"} />;
    case "embed":
      return (
        <section className="py-12">
          <Container size="narrow">
            <ConsentEmbed title={block.title} src={block.url} />
          </Container>
        </section>
      );
    default:
      return null;
  }
}

/** Check-circle bullet list used in the intro sections. */
function CheckList({ items, className = "" }: { items: string[]; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {items.map((p) => (
        <li key={p} className="flex items-start gap-3 text-lg text-heading">
          <span className="mt-[0.3rem] grid size-[1.1rem] shrink-0 place-items-center rounded-full bg-heading text-white">
            <Icon name="check" className="size-3" />
          </span>
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- hero

async function HeroBlock({ block, asH1 }: { block: BlockOf<"hero">; asH1: boolean }) {
  const H = asH1 ? "h1" : "h2";
  const media = await getImage(block.imageId);
  const src = media?.url ?? imageUrl(block.imageSrc);
  return (
    <section className="relative overflow-hidden bg-band">
      <Container className="relative grid items-center gap-12 py-16 lg:min-h-[52.5rem] lg:grid-cols-[7fr_5fr] lg:gap-0 lg:py-24">
        <div>
          {block.eyebrow && (
            <div className="lp-slide-in-up">
              <Eyebrow>{block.eyebrow}</Eyebrow>
            </div>
          )}
          <div className="mt-5">
            <H className="inline text-[3rem] leading-[1.11] font-semibold text-navy-600 sm:text-6xl lg:text-[5.25rem]">{block.heading}</H>
            {(block.badgeTitle || block.badgeText) && (
              <span className="lp-slide-in-up mt-6 inline-flex items-center gap-4 align-middle lg:mt-0 lg:ml-10 lg:translate-y-[-0.9rem]">
                <Image src="/theme/rev.png" alt="" width={112} height={56} className="h-auto w-24" />
                <span className="block">
                  {block.badgeTitle && <CountUp text={block.badgeTitle} className="block font-display text-lg text-navy-600" />}
                  {block.badgeText && (
                    <span className="flex items-center gap-1 text-[0.875rem] font-medium text-heading">
                      <Stars /> <CountUp text={block.badgeText} />
                    </span>
                  )}
                </span>
              </span>
            )}
          </div>
          {block.text && <p className="mt-6 max-w-xl text-ink">{block.text}</p>}
          <div className="lp-slide-in-up mt-12 flex flex-wrap gap-3">
            {block.primary.href && (
              <ButtonLink href={block.primary.href} arrow>
                {block.primary.label}
              </ButtonLink>
            )}
            {block.secondary.href && (
              <ButtonLink href={block.secondary.href} variant="outline">
                {block.secondary.label}
              </ButtonLink>
            )}
          </div>
          {block.points.length > 0 && <CheckList items={block.points} className="mt-10" />}
        </div>
        {src && (
          <div className="relative mx-auto w-full max-w-[32rem] pt-5 pr-5">
            <div className="relative">
              {/* Live site: a full gold outline the size of the photo, shifted 18px up and right, behind it. */}
              <span aria-hidden="true" className="absolute inset-0 translate-x-[18px] -translate-y-[18px] rounded-tr-[100px] rounded-bl-[100px] border-[2.4px] border-gold-400" />
              <div className="relative aspect-[499/599] overflow-hidden rounded-tr-[100px] rounded-bl-[100px]">
                <Image src={src} alt={media?.alt ?? ""} fill loading="eager" fetchPriority="high" sizes="(min-width: 1024px) 500px, 90vw" className="object-cover" />
              </div>
            </div>
            <span aria-hidden="true" className="absolute top-[30%] -left-4 hidden size-[4.4rem] place-items-center rounded-full border border-gold-500/70 sm:grid">
              <Image src="/theme/logo-icon.png" alt="" width={48} height={45} className="h-auto w-10 opacity-80" />
            </span>
          </div>
        )}
      </Container>
    </section>
  );
}

function Stars({ count = 5 }: { count?: number }) {
  return (
    <span className="inline-flex text-[#f5a623]" aria-label={`${count} out of 5 stars`} role="img">
      {Array.from({ length: count }, (_, i) => (
        <Icon key={i} name="star-filled" className="size-[1.05rem]" />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- intro (image + text + ticks)

function IntroBlock({ block }: { block: BlockOf<"intro"> }) {
  const [a, b, c] = [imageUrl(block.imageSrc), imageUrl(block.imageSrc2), imageUrl(block.imageSrc3)];
  const collage = Boolean(b && c);
  return (
    <section className="bg-paper-warm py-20 lg:py-[7.5rem]">
      <Container className={`grid items-center gap-14 lg:gap-[5.75rem] ${collage ? "lg:grid-cols-[1.23fr_1fr] lg:gap-[4.4rem]" : "lg:grid-cols-[32rem_1fr]"}`}>
        <div className="relative">
          {collage ? (
            <div className="relative grid grid-cols-[0.88fr_1fr] gap-6 pt-6 pl-6">
              <span aria-hidden="true" className="absolute top-0 left-0 h-[85%] w-[45%] rounded-tl-[3.75rem] border border-navy-700 border-r-0 border-b-0" />
              <div className="relative row-span-2 aspect-[312/574] overflow-hidden rounded-tl-[3.75rem] rounded-br-[3.75rem]">
                <Image src={a!} alt="" fill sizes="(min-width: 1024px) 312px, 45vw" className="object-cover" />
              </div>
              <div className="relative aspect-[354/275] overflow-hidden rounded-tl-[3.75rem] rounded-br-[3.75rem]">
                <Image src={b!} alt="" fill sizes="(min-width: 1024px) 354px, 50vw" className="object-cover" />
              </div>
              <div className="relative aspect-[354/275] overflow-hidden rounded-tl-[3.75rem] rounded-br-[3.75rem]">
                <Image src={c!} alt="" fill sizes="(min-width: 1024px) 354px, 50vw" className="object-cover" />
              </div>
              <span aria-hidden="true" className="absolute top-[52%] left-[44%] grid size-[7.5rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-navy-700">
                <Image src="/theme/logo-icon.png" alt="" width={56} height={52} className="h-auto w-12 brightness-0 invert" />
              </span>
            </div>
          ) : (
            a && (
              <div className="relative ml-6 mt-6">
                {/* Live site: a full navy outline shifted 24px up and left, slightly shorter than the photo. */}
                <span aria-hidden="true" className="absolute -top-6 right-6 bottom-[35px] -left-6 rounded-[90px_0_100px_100px] border border-navy-700" />
                <div className="relative aspect-[499/565] overflow-hidden rounded-[90px_0_100px_100px]">
                  <Image src={a} alt="" fill sizes="(min-width: 1024px) 500px, 90vw" className="object-cover" />
                </div>
              </div>
            )
          )}
        </div>
        <div>
          {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
          <h2 className={`${block.eyebrow ? "mt-3" : ""} ${collage ? "text-[2.5rem] sm:text-[3.375rem]" : "text-3xl sm:text-[2.3rem]"} leading-[1.18] text-heading`}>{block.heading}</h2>
          {block.text && <p className="mt-6 leading-[1.75] text-ink">{block.text}</p>}
          <CheckList items={block.points} className="mt-6" />
          {block.pointsHeading && <p className="mt-8 font-semibold text-heading">{block.pointsHeading}</p>}
          <CheckList items={block.points2} className="mt-5" />
          {block.primary.href && (
            <div className="mt-10">
              <ButtonLink href={block.primary.href} arrow>
                {block.primary.label}
              </ButtonLink>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------- stats band

function StatsBlock({ block }: { block: BlockOf<"stats"> }) {
  // Figures appear only once an editor confirms they are verified.
  if (!block.verified || !block.items.length) return null;
  return (
    <section className="bg-[linear-gradient(#f5f5f5_0_50%,#fff_50%_100%)]">
      <Container>
        <ul className="grid grid-cols-2 gap-y-10 rounded-[1.25rem] bg-navy-700 px-6 py-14 text-white sm:px-12 lg:flex lg:justify-between lg:py-20">
          {block.items.map((s, i) => (
            <li key={s.label} className={`flex items-center gap-4 lg:px-6 ${i > 0 ? "lg:border-l lg:border-white/20 lg:pl-14" : ""}`}>
              {s.iconSrc && <Image src={imageUrl(s.iconSrc)!} alt="" width={60} height={60} className="size-[3.75rem] shrink-0 object-contain" />}
              <span>
                <CountUp text={s.value.replace(/\+$/, " +")} className="block text-[2.25rem] leading-none font-medium" />
                <span className="mt-1 block">{s.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------- steps

function StepsBlock({ block }: { block: BlockOf<"steps"> }) {
  return (
    <section className="py-20 lg:pt-[8.5rem] lg:pb-16">
      <Container>
        <SectionHeading eyebrow={block.eyebrow} heading={block.heading} align="center" />
        <ol className="relative mt-14 grid gap-14 md:grid-cols-3 md:gap-8">
          {block.items.map((s, i) => (
            <li key={s.title} className="relative text-center">
              {i < block.items.length - 1 && <span aria-hidden="true" className="absolute top-[6.75rem] left-[calc(50%+6.9rem)] hidden w-[calc(100%-13.8rem+2rem)] border-t-2 border-dashed border-navy-700 md:block" />}
              <div className="relative mx-auto grid size-[13.75rem] place-items-center rounded-full border-2 border-dashed border-gold-500 p-2">
                <span className="grid size-full place-items-center rounded-full bg-navy-700">
                  {s.iconSrc ? <Image src={imageUrl(s.iconSrc)!} alt="" width={80} height={80} className="size-20 object-contain" /> : <Icon name="check" className="size-16 text-white" />}
                </span>
                <span className="absolute top-2 right-2 grid size-[3.75rem] place-items-center rounded-full bg-gold-500 text-[1.75rem] font-medium text-white">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-8 text-[1.875rem] leading-[1.42] font-semibold text-heading">{s.title}</h3>
              <p className="mx-auto mt-3 max-w-sm text-ink">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------- services

async function ServicesBlock({ block }: { block: BlockOf<"services"> }) {
  const all = await listServices();
  const services = block.limit ? all.slice(0, block.limit) : all;
  return (
    <section className="relative bg-[#f0f0f0] py-0">
      <div className="mx-auto max-w-[84.375rem] bg-[#f4f4f4] bg-[url('/theme/team-2-shape-bg.png')] bg-cover bg-center px-4 pt-20 pb-24 sm:px-6 lg:pt-[7.5rem] xl:px-[0.9375rem]">
        <Container className="!px-0">
          <Carousel centered header={<SectionHeading eyebrow={block.eyebrow} heading={block.heading} text={block.text} align="center" />} label="services" itemClass="basis-full sm:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-4.5rem)/4)]">
            {services.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </Carousel>
        </Container>
      </div>
      <div className="relative -mt-7 flex justify-center pb-0">
        <ButtonLink href="/service/">View All Services</ButtonLink>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- reviews

async function ReviewsBlock({ block, fullPage }: { block: BlockOf<"reviews">; fullPage: boolean }) {
  const [items, { integrations }] = await Promise.all([listTestimonials(), getSettings()]);
  if (!items.length && !integrations.trustindexWidgetId) return null;
  const header = <SectionHeading eyebrow="Client Testimonials" heading={block.heading || "What Our Clients Say"} text={block.text} />;
  return (
    <section className="py-20 lg:py-[7.5rem]">
      <Container>
        {items.length > 0 && (
          <Carousel header={header} label="testimonials" itemClass="basis-full lg:basis-[calc((100%-1.5rem)/2)]">
            {items.map((t) => (
              <figure key={t.id} className="relative h-full rounded-[1.25rem] border-b-[6px] border-gold-500 bg-white p-10 shadow-[0_10px_30px_-12px_rgba(0,0,0,.12)]">
                <span aria-hidden="true" className="absolute top-0 right-0 grid size-28 place-items-center rounded-tr-[1.25rem] rounded-bl-[3.75rem] bg-paper-warm">
                  <Image src="/theme/google-icon-300x150-1.png" alt="" width={72} height={36} className="h-auto w-[4.5rem]" />
                </span>
                <figcaption className="flex items-center gap-4 pr-24">
                  {t.photoSrc ? (
                    <Image src={imageUrl(t.photoSrc)!} alt="" width={80} height={80} className="size-20 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-20 place-items-center rounded-full bg-navy-700 font-display text-2xl text-white">{t.name.charAt(0)}</span>
                  )}
                  <span>
                    <span className="block font-display text-2xl font-semibold text-heading">{t.name}</span>
                    <span className="block text-ink">{t.role || "Client"}</span>
                    <Stars count={t.rating} />
                  </span>
                </figcaption>
                <blockquote className="mt-8 leading-[1.75] text-ink">{t.quote}</blockquote>
              </figure>
            ))}
          </Carousel>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          {!fullPage && (
            <Link href="/review/" className="inline-flex h-[4.5rem] items-center gap-5 rounded-full bg-[#1d3c6b] px-8 text-white underline hover:bg-gold-500">
              <Icon name="google" className="size-8" />
              See all Reviews
            </Link>
          )}
        </div>
        {fullPage && integrations.trustindexWidgetId && (
          <div className="mt-10">
            <TrustindexWidget id={integrations.trustindexWidgetId} />
          </div>
        )}
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------- blog

async function LatestPostsBlock({ block }: { block: BlockOf<"latestPosts"> }) {
  const posts = await latestPosts(Math.max(block.count, 6));
  if (!posts.length) return null;
  return (
    <section className="pt-16 pb-14 lg:pt-[7.5rem]">
      <Container>
        <Carousel header={<SectionHeading eyebrow={block.eyebrow} heading={block.heading || "Our Blog"} />} label="articles">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </Carousel>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------- split (image + text)

function SplitBlock({ block }: { block: BlockOf<"split"> }) {
  const src = imageUrl(block.imageSrc);
  return (
    <section>
      <div className="mx-auto grid max-w-[84.375rem] items-center gap-12 bg-[#f3f3f3] py-16 lg:grid-cols-[41.375rem_1fr] lg:gap-[4.375rem] lg:py-[7.5rem] lg:pr-6">
        {src && (
          <div className="relative aspect-[667/595]">
            {/* Live site: a thin gold outline shifted 22px up, behind the photo. */}
            <span aria-hidden="true" className="absolute -top-[22px] right-0 bottom-[22px] left-[27px] rounded-[24px] border border-gold-400" />
            <div className="relative size-full overflow-hidden rounded-r-[24px] lg:rounded-[24px]">
              <Image src={src} alt="" fill sizes="(min-width: 1024px) 667px, 100vw" className="object-cover" />
            </div>
          </div>
        )}
        <div className="px-4 sm:px-6 lg:px-0">
          <h2 className="text-[2.5rem] leading-[1.18] text-navy-700 sm:text-[3.75rem]">{block.heading}</h2>
          {block.text && <p className="mt-10 leading-[1.75] text-ink">{block.text}</p>}
          {block.primary.href && (
            <Link href={block.primary.href} className="mt-6 inline-flex h-[4.2rem] items-center gap-2 rounded-full bg-gold-500 px-8 text-lg text-white transition-colors hover:bg-navy-700">
              <Icon name="calendar" className="size-7" />
              {block.primary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- client logos

function LogosBlock({ block }: { block: BlockOf<"logos"> }) {
  const items = block.items.filter((l) => l.src);
  if (!items.length) return null;
  return (
    <section className="py-16 lg:pt-[4.25rem] lg:pb-24">
      <Container>
        {block.heading && <h2 className="text-center text-3xl font-semibold text-[#0b1a24] sm:text-[2.3rem]">{block.heading}</h2>}
        <div className="relative mt-14 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
          <ul className="flex w-max animate-[lp-marquee_30s_linear_infinite] items-center gap-16 motion-reduce:animate-none">
            {[...items, ...items].map((l, i) => (
              <li key={i} aria-hidden={i >= items.length || undefined} className="flex h-40 w-[16.875rem] shrink-0 items-center justify-center">
                <Image src={imageUrl(l.src)!} alt={i < items.length ? l.alt : ""} width={270} height={160} className="max-h-40 w-auto object-contain" />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------- simple sections

function FeaturesBlock({ block }: { block: BlockOf<"features"> }) {
  return (
    <section className="py-20 lg:py-[7.5rem]">
      <Container>
        <SectionHeading eyebrow={block.eyebrow} heading={block.heading} text={block.text} align="center" />
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((f) => (
            <li key={f.title} className="rounded-[1.25rem] border-b-[6px] border-gold-500 bg-white p-8 shadow-[0_10px_30px_-12px_rgba(0,0,0,.12)]">
              <h3 className="text-2xl font-semibold text-heading">{f.title}</h3>
              <p className="mt-3 text-ink">{f.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

async function DocumentsBlock({ block }: { block: BlockOf<"documents"> }) {
  const docs = await listDocuments(block.group === "all" ? undefined : block.group);
  return (
    <section className="bg-paper-warm py-20 lg:py-[7.5rem]">
      <Container>
        <SectionHeading eyebrow={block.eyebrow} heading={block.heading} text={block.text} align="center" />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <DocumentCard key={d.slug} doc={d} />
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FaqBlock({ block }: { block: Pick<BlockOf<"faq">, "heading" | "items"> }) {
  if (!block.items.length) return null;
  return (
    <section className="py-20">
      <Container size="narrow">
        {block.heading && <h2 className="text-3xl sm:text-4xl">{block.heading}</h2>}
        <div className="mt-10 space-y-3">
          {block.items.map((f) => (
            <details key={f.question} className="group rounded-[1.25rem] bg-paper-warm px-7 py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-xl font-semibold text-heading [&::-webkit-details-marker]:hidden">
                {f.question}
                <Icon name="chevron-down" className="mt-1 size-5 shrink-0 text-gold-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 whitespace-pre-line text-ink">{f.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function CtaBlock({ block }: { block: Pick<BlockOf<"cta">, "heading" | "text" | "primary" | "secondary"> & { variant?: "band" | "simple" } }) {
  if (block.variant === "simple") {
    return (
      <section className="pt-4 pb-14 text-center">
        <Container>
          <h3 className="font-sans text-[1.6rem] font-semibold text-[#333]">{block.heading}</h3>
          {block.text && <p className="mt-3 text-ink">{block.text}</p>}
          {block.primary.href && (
            <div className="mt-6">
              <ButtonLink href={block.primary.href}>{block.primary.label}</ButtonLink>
            </div>
          )}
        </Container>
      </section>
    );
  }
  return (
    <section className="px-4 py-14 sm:px-6">
      <div className="mx-auto flex max-w-[82.5rem] flex-col items-center gap-6 rounded-[1.25rem] bg-navy-700 px-6 py-16 text-center text-white sm:px-14">
        <h2 className="max-w-3xl text-3xl text-white sm:text-[2.75rem]">{block.heading}</h2>
        {block.text && <p className="max-w-2xl text-white/80">{block.text}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          {block.primary.href && (
            <ButtonLink href={block.primary.href} arrow>
              {block.primary.label}
            </ButtonLink>
          )}
          {block.secondary.href && (
            <ButtonLink href={block.secondary.href} variant="light">
              {block.secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- contact

function ContactInfo({ iconSrc, title, children }: { iconSrc: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-20 shrink-0 place-items-center rounded-full bg-navy-700">
        <Image src={iconSrc} alt="" width={45} height={40} className="h-10 w-auto" />
      </span>
      <div>
        <p className="font-display text-[1.375rem] leading-[1.3] whitespace-nowrap text-heading">{title}</p>
        <div className="mt-1 text-[0.875rem] leading-[1.8] text-ink">{children}</div>
      </div>
    </li>
  );
}

async function OfficesBlock({ block }: { block: BlockOf<"offices"> }) {
  const { site } = await getSettings();
  return (
    <section className="py-16">
      <Container>
        {block.heading && <h2 className="text-3xl sm:text-4xl">{block.heading}</h2>}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {site.offices.map((o) => (
            <div key={o.city} className="flex flex-col rounded-[1.25rem] bg-paper-warm p-6">
              <p className="font-display text-xl text-heading">{o.city}</p>
              <p className="mt-2 flex-1 text-ink">{o.address}</p>
              {block.showMap && (
                <div className="mt-5">
                  <ConsentEmbed title={`Map of our ${o.city} office`} src={`https://www.google.com/maps?q=${encodeURIComponent(o.mapQuery || o.address)}&output=embed`} ratio="aspect-[4/3]" cta="Show map" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

async function ContactFormBlock({ block }: { block: BlockOf<"contactForm"> }) {
  const { site } = await getSettings();
  const def = getFormDefinition("contact")!;
  const officeTitle = (city: string, i: number) => (i === 0 ? `${city} Address` : `${city} Office`);
  return (
    <section className="py-20 lg:py-[7.5rem]">
      <Container>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
          {site.offices.map((o, i) => (
            <ContactInfo key={o.city} iconSrc="/theme/contact-icon-1.svg" title={officeTitle(o.city, i)}>
              {o.address}
            </ContactInfo>
          ))}
          <ContactInfo iconSrc="/theme/contact-icon-2.svg" title="Phone">
            {site.phones.map((p) => (
              <a key={p} href={`tel:${p.replace(/\s+/g, "")}`} className="block hover:text-gold-500">
                {p}
              </a>
            ))}
          </ContactInfo>
          <ContactInfo iconSrc="/theme/contact-icon-3.svg" title="Email">
            <a href={`mailto:${site.email}`} className="hover:text-gold-500">
              {site.email}
            </a>
          </ContactInfo>
        </ul>
        <div className="mt-24 grid gap-8 lg:grid-cols-[1fr_0.73fr]">
          <div className="rounded-[1.25rem] bg-paper-warm p-6 sm:p-[3.75rem]">
            <h2 className="text-3xl sm:text-[2.3rem]">{block.heading || "Get in Touch with Us"}</h2>
            {block.text && <p className="mt-3 text-ink">{block.text}</p>}
            <div className="mt-6">
              <FormRenderer def={def} />
            </div>
          </div>
          <div className="relative hidden min-h-[30rem] overflow-hidden lg:block">
            <Image src="/theme/lexpraxis-support.jpg" alt="" fill sizes="(min-width: 1024px) 537px, 0px" className="object-cover" />
          </div>
        </div>
      </Container>
    </section>
  );
}

// Shows the Calendly calendar set in Admin → Settings → Integrations. Until a
// link is set, visitors request a consultation through the contact form instead.
async function CalendlyBlock({ block }: { block: BlockOf<"calendly"> }) {
  const { integrations, site } = await getSettings();
  const url = integrations.calendlyUrl;
  return (
    <section className="py-16 lg:py-24">
      <Container>
        {url && block.heading && <h2 className="text-center text-3xl sm:text-[2.3rem]">{block.heading}</h2>}
        {url && block.text && <p className="mx-auto mt-3 max-w-2xl text-center text-ink">{block.text}</p>}
        <div className="mx-auto mt-10 max-w-5xl">
          {url ? (
            <CalendlyEmbed url={url} />
          ) : (
            <div className="rounded-[1.25rem] bg-paper-warm p-6 sm:p-[3.75rem]">
              <h2 className="text-3xl sm:text-[2.3rem]">Request a consultation</h2>
              <p className="mt-3 text-ink">
                Tell us about your business and what you need, and we&apos;ll contact you to arrange a time. You can also call{" "}
                {site.phones[0] && (
                  <a href={`tel:${site.phones[0].replace(/\s+/g, "")}`} className="text-navy-900 underline">
                    {site.phones[0]}
                  </a>
                )}{" "}
                or email{" "}
                <a href={`mailto:${site.email}`} className="text-navy-900 underline">
                  {site.email}
                </a>
                .
              </p>
              <div className="mt-6">
                <FormRenderer def={getFormDefinition("contact")!} />
              </div>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
