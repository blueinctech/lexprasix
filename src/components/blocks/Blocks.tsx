import Image from "next/image";
import Link from "next/link";
import type { AnyBlock, BlockOf } from "@/lib/blocks";
import { getImage, getSettings, latestPosts, listDocuments, listServices, listTestimonials, resolveMediaInHtml } from "@/lib/content/queries";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { getFormDefinition } from "@/forms/registry";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, Eyebrow, SectionHeading } from "@/components/ui/primitives";
import { DocumentCard, PostGrid, Prose, ServiceCard, Watermark } from "@/components/content/common";
import { CalendlyEmbed, ConsentEmbed, TrustindexWidget } from "./Embeds";

// Renders a page's blocks. Section spacing alternates paper / warm / navy so
// consecutive sections read as distinct without heavy dividers.

export async function Blocks({ blocks, h1Title }: { blocks: AnyBlock[]; h1Title?: string }) {
  // The first hero carries the page H1 (exactly one per page).
  const h1Index = h1Title ? blocks.findIndex((b) => b.type === "hero") : -1;
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={block.id} block={block} asH1={i === h1Index} />
      ))}
    </>
  );
}

function Block({ block, asH1 }: { block: AnyBlock; asH1: boolean }) {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} asH1={asH1} />;
    case "richText":
      return (
        <section className="py-14 sm:py-20">
          <Container size="narrow">
            {block.heading && <h2 className="mb-8 text-3xl text-navy-950 sm:text-4xl">{block.heading}</h2>}
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
              <blockquote className="mt-6 font-display text-2xl leading-snug text-navy-950 sm:text-3xl">{block.text}</blockquote>
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
      return <ReviewsBlock block={block} />;
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

async function HeroBlock({ block, asH1 }: { block: BlockOf<"hero">; asH1: boolean }) {
  const H = asH1 ? "h1" : "h2";
  const [image, docs] = await Promise.all([getImage(block.imageId), block.imageId ? Promise.resolve([]) : listDocuments()]);
  const featured = ["company-registration", "business-name-registration", "trademark-registration", "non-disclosure-agreements", "us-company-registration", "tenancy-agreement"]
    .map((slug) => docs.find((d) => d.slug === slug))
    .filter(Boolean) as { slug: string; title: string; group: string }[];
  return (
    <section className="relative overflow-hidden bg-paper-warm">
      <Watermark className="-right-40 -top-24 h-[52rem]" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/40 to-transparent" aria-hidden="true" />
      <Container className="relative grid items-center gap-14 py-16 sm:py-24 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-7">
          {block.eyebrow && <Eyebrow>{block.eyebrow}</Eyebrow>}
          <H className="mt-6 text-[2.6rem] leading-[1.06] text-navy-950 sm:text-6xl lg:text-[4.25rem]">{block.heading}</H>
          {block.text && <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-muted sm:text-xl">{block.text}</p>}
          <div className="mt-10 flex flex-wrap gap-3">
            {block.primary.href && (
              <ButtonLink href={block.primary.href} size="lg" arrow>
                {block.primary.label}
              </ButtonLink>
            )}
            {block.secondary.href && (
              <ButtonLink href={block.secondary.href} size="lg" variant="outline">
                {block.secondary.label}
              </ButtonLink>
            )}
          </div>
          {block.points.length > 0 && (
            <ul className="mt-12 grid gap-3 text-[0.95rem] text-ink sm:grid-cols-3">
              {block.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-gold-500/15 text-gold-700">
                    <Icon name="check" className="size-3.5" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="lg:col-span-5">
          {image ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem]">
              <Image src={image.url} alt={image.alt} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
            </div>
          ) : (
            <div className="relative rounded-[1.75rem] bg-navy-950 p-7 text-white shadow-[0_40px_80px_-40px_rgba(11,22,48,.6)] sm:p-9">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold tracking-[0.22em] text-gold-300 uppercase">Start online</p>
                <Icon name="lock" className="size-4 text-white/40" />
              </div>
              <p className="mt-4 font-display text-2xl leading-snug">Begin a filing or agreement in minutes.</p>
              <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
                {featured.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/${d.slug}/`} className="group flex items-center justify-between py-3.5 text-[0.95rem] text-white/85 hover:text-white">
                      <span className="flex items-center gap-3">
                        <Icon name={d.group === "agreements" ? "contract" : "file-text"} className="size-4 text-gold-300" />
                        {d.title}
                      </span>
                      <Icon name="arrow-right" className="size-4 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-300" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/legal-forms/" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gold-300 hover:text-white">
                See all legal documents <Icon name="arrow-right" className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

async function ServicesBlock({ block }: { block: BlockOf<"services"> }) {
  const all = await listServices();
  const services = block.limit ? all.slice(0, block.limit) : all;
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow={block.eyebrow} heading={block.heading} text={block.text} />
          <ButtonLink href="/service/" variant="outline" arrow className="shrink-0">
            All services
          </ButtonLink>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <ServiceCard key={s.slug} service={s} index={i} />
          ))}
        </div>
      </Container>
    </section>
  );
}

function StepsBlock({ block }: { block: BlockOf<"steps"> }) {
  return (
    <section className="relative overflow-hidden bg-navy-950 py-20 text-white sm:py-28">
      <Watermark light className="-left-32 -bottom-40 h-[40rem]" />
      <Container className="relative">
        <SectionHeading eyebrow={block.eyebrow} heading={block.heading} light />
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {block.items.map((s, i) => (
            <li key={s.title} className="relative border-t border-white/15 pt-8">
              <span className="font-display text-5xl text-gold-300/90">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-5 text-2xl text-white">{s.title}</h3>
              <p className="mt-3 text-white/70">{s.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function FeaturesBlock({ block }: { block: BlockOf<"features"> }) {
  return (
    <section className="py-20 sm:py-28">
      <Container className="grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <SectionHeading eyebrow={block.eyebrow} heading={block.heading} text={block.text} />
          </div>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:col-span-7">
          {block.items.map((f) => (
            <li key={f.title} className="bg-white p-7">
              <Icon name="check" className="size-5 text-gold-600" />
              <h3 className="mt-4 font-display text-xl text-navy-950">{f.title}</h3>
              <p className="mt-2 text-[0.95rem] text-ink-muted">{f.text}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function StatsBlock({ block }: { block: BlockOf<"stats"> }) {
  // Unverified figures are never shown publicly.
  if (!block.verified || !block.items.length) return null;
  return (
    <section className="border-y border-line bg-white">
      <Container className="grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
        {block.items.map((s) => (
          <div key={s.label}>
            <p className="font-display text-4xl text-navy-950 sm:text-5xl">{s.value}</p>
            <p className="mt-1 text-sm text-ink-muted">{s.label}</p>
          </div>
        ))}
      </Container>
    </section>
  );
}

async function DocumentsBlock({ block }: { block: BlockOf<"documents"> }) {
  const docs = await listDocuments(block.group === "all" ? undefined : block.group);
  const groups = block.group === "all" ? (["corporate-filings", "agreements"] as const) : [block.group];
  const label = { "corporate-filings": "Corporate filings", agreements: "Agreements" } as const;
  return (
    <section className="bg-paper-warm py-20 sm:py-28">
      <Container>
        <SectionHeading eyebrow={block.eyebrow} heading={block.heading} text={block.text} />
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="mb-4 text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">{label[g]}</h3>
              <div className="grid gap-2.5">
                {docs
                  .filter((d) => d.group === g)
                  .map((d) => (
                    <DocumentCard key={d.slug} doc={d} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

async function LatestPostsBlock({ block }: { block: BlockOf<"latestPosts"> }) {
  const posts = await latestPosts(block.count);
  if (!posts.length) return null;
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow={block.eyebrow} heading={block.heading} />
          <ButtonLink href="/blog/" variant="outline" arrow className="shrink-0">
            All articles
          </ButtonLink>
        </div>
        <div className="mt-14">
          <PostGrid posts={posts} />
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
        {block.heading && <h2 className="text-3xl text-navy-950 sm:text-4xl">{block.heading}</h2>}
        <div className="mt-10 divide-y divide-line border-y border-line">
          {block.items.map((f) => (
            <details key={f.question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-medium text-navy-950 [&::-webkit-details-marker]:hidden">
                {f.question}
                <Icon name="chevron-down" className="mt-1 size-5 shrink-0 text-gold-700 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 whitespace-pre-line text-ink-muted">{f.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function CtaBlock({ block }: { block: Pick<BlockOf<"cta">, "heading" | "text" | "primary" | "secondary"> }) {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-navy-900 px-6 py-16 text-white sm:px-14 sm:py-20">
        <Watermark light className="-right-20 -top-28 h-[36rem]" />
        <div className="relative grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="text-3xl text-white sm:text-5xl">{block.heading}</h2>
            {block.text && <p className="mt-5 max-w-2xl text-lg text-white/75">{block.text}</p>}
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-4 lg:justify-end">
            {block.primary.href && (
              <ButtonLink href={block.primary.href} variant="gold" size="lg" arrow>
                {block.primary.label}
              </ButtonLink>
            )}
            {block.secondary.href && (
              <ButtonLink href={block.secondary.href} variant="light" size="lg">
                {block.secondary.label}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

async function OfficesBlock({ block }: { block: BlockOf<"offices"> }) {
  const { site } = await getSettings();
  return (
    <section className="bg-paper-warm py-20">
      <Container>
        {block.heading && <h2 className="text-3xl text-navy-950 sm:text-4xl">{block.heading}</h2>}
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {site.offices.map((o) => (
            <div key={o.city} className="flex flex-col rounded-2xl border border-line bg-white p-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">{o.city}</p>
              <p className="mt-3 flex-1 text-ink">{o.address}</p>
              {o.phone && <p className="mt-3 text-sm text-ink-muted">{o.phone}</p>}
              {block.showMap && (
                <div className="mt-5">
                  <ConsentEmbed title={`Map of our ${o.city} office`} src={`https://www.google.com/maps?q=${encodeURIComponent(o.mapQuery || o.address)}&output=embed`} ratio="aspect-[4/3]" cta="Show map" />
                </div>
              )}
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.mapQuery || o.address)}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 hover:text-gold-700">
                Get directions <Icon name="arrow-up-right" className="size-4" />
              </a>
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
  return (
    <section className="py-16 sm:py-24">
      <Container className="grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          {block.heading && <h2 className="text-3xl text-navy-950">{block.heading}</h2>}
          {block.text && <p className="mt-4 text-ink-muted">{block.text}</p>}
          <dl className="mt-10 space-y-6">
            <div>
              <dt className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">Call us</dt>
              {site.phones.map((p) => (
                <dd key={p} className="mt-2">
                  <a href={`tel:${p.replace(/\s+/g, "")}`} className="text-lg text-navy-950 hover:text-gold-700">
                    {p}
                  </a>
                </dd>
              ))}
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">Email</dt>
              <dd className="mt-2">
                <a href={`mailto:${site.email}`} className="text-lg text-navy-950 hover:text-gold-700">
                  {site.email}
                </a>
              </dd>
            </div>
            {site.whatsapp && (
              <div>
                <dt className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">WhatsApp</dt>
                <dd className="mt-2">
                  <a href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-lg text-navy-950 hover:text-gold-700">
                    <Icon name="whatsapp" className="size-5 text-[#1f9d55]" /> Chat with us
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
        <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_30px_60px_-40px_rgba(11,22,48,.35)] sm:p-10 lg:col-span-8">
          <FormRenderer def={def} />
        </div>
      </Container>
    </section>
  );
}

async function CalendlyBlock({ block }: { block: BlockOf<"calendly"> }) {
  const { integrations, site } = await getSettings();
  return (
    <section className="py-16 sm:py-20">
      <Container className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          {block.heading && <h2 className="text-3xl text-navy-950">{block.heading}</h2>}
          {block.text && <p className="mt-4 text-ink-muted">{block.text}</p>}
          <ul className="mt-8 space-y-3 text-[0.95rem]">
            {["Free, no obligation", "30 minutes by phone or video", "Get clear next steps for your business"].map((x) => (
              <li key={x} className="flex items-center gap-3">
                <Icon name="check" className="size-4 text-gold-600" /> {x}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-sm text-ink-muted">
            Prefer to talk now? Call <a className="text-navy-900 underline" href={`tel:${site.phones[0]?.replace(/\s+/g, "")}`}>{site.phones[0]}</a>.
          </p>
        </div>
        <div className="lg:col-span-8">{integrations.calendlyUrl ? <CalendlyEmbed url={integrations.calendlyUrl} /> : <p className="rounded-2xl border border-line bg-white p-8 text-ink-muted">Online booking is temporarily unavailable. Please call or email us.</p>}</div>
      </Container>
    </section>
  );
}

async function ReviewsBlock({ block }: { block: BlockOf<"reviews"> }) {
  const [items, { integrations }] = await Promise.all([listTestimonials(), getSettings()]);
  if (!items.length && !integrations.trustindexWidgetId) return null;
  return (
    <section className="bg-paper-warm py-20 sm:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow="Client testimonials" heading={block.heading || "What our clients say"} text={block.text} />
          <ButtonLink href="/review/" variant="outline" arrow className="shrink-0">
            All reviews
          </ButtonLink>
        </div>
        <div className="mt-14 columns-1 gap-5 md:columns-2 lg:columns-3">
          {items.map((t) => (
            <figure key={t.id} className="mb-5 break-inside-avoid rounded-2xl border border-line bg-white p-7">
              <Icon name="quote" className="size-7 text-gold-500" />
              <blockquote className="mt-4 text-[0.98rem] leading-relaxed text-ink">{t.quote}</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-5">
                <span className="grid size-10 place-items-center rounded-full bg-navy-900 font-display text-white">{t.name.charAt(0)}</span>
                <span>
                  <span className="block font-medium text-navy-950">{t.name}</span>
                  {t.role && <span className="block text-sm text-ink-muted">{t.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        {integrations.trustindexWidgetId && (
          <div className="mt-10">
            <TrustindexWidget id={integrations.trustindexWidgetId} />
          </div>
        )}
      </Container>
    </section>
  );
}
