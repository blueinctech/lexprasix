import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AnyBlock } from "@/lib/blocks";
import { getDocument, getPageByPath, getPost, getService, getSettings, listDocuments, listServices, resolveMediaInHtml } from "@/lib/content/queries";
import { addHeadingIds, plainText, sanitizeRichHtml } from "@/lib/sanitize";
import { absoluteUrl, articleNode, breadcrumbNode, faqNode, graph, organizationNode, webPageNode, websiteNode } from "@/lib/seo";
import { getFormDefinition } from "@/forms/registry";
import { fieldsOf } from "@/forms/types";
import { Blocks, CtaBlock, FaqBlock } from "@/components/blocks/Blocks";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, formatDate } from "@/components/ui/primitives";
import { Breadcrumbs, JsonLd, PageHeader, PostGrid, Prose, ServiceCard } from "./common";
import { ShareLinks } from "./ShareLinks";

// Data shapes passed in come from the cached queries; these views are reused
// by the admin preview, which passes draft records directly.

type Post = NonNullable<Awaited<ReturnType<typeof getPost>>>;
type Doc = NonNullable<Awaited<ReturnType<typeof getDocument>>>;
type Svc = NonNullable<Awaited<ReturnType<typeof getService>>>;
type Page = NonNullable<Awaited<ReturnType<typeof getPageByPath>>>;

// ---------------------------------------------------------------- blog post

export async function PostView({ post }: { post: Post }) {
  const settings = await getSettings();
  const path = `/${post.slug}/`;
  const { html, toc } = addHeadingIds(post.html);
  const topCategory = post.categories.find((c) => !["blog", "uncategorized"].includes(c.slug)) ?? post.categories[0];
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog/" },
    ...(topCategory && topCategory.slug !== "blog" ? [{ name: topCategory.name, path: `/category/${topCategory.slug}/` }] : []),
    { name: post.title, path },
  ];
  const updated = post.contentUpdatedAt && post.publishedAt && post.contentUpdatedAt.getTime() - post.publishedAt.getTime() > 86_400_000 ? post.contentUpdatedAt : null;
  const comments = post.comments.filter((c) => !c.parentId);
  const replies = (id: string) => post.comments.filter((c) => c.parentId === id);
  return (
    <>
      <JsonLd
        data={graph(
          articleNode({ path, title: post.title, description: post.seo.description || post.excerpt, image: post.featuredImage, datePublished: post.publishedAt ?? new Date(), dateModified: post.contentUpdatedAt ?? post.publishedAt ?? new Date(), author: post.author, keywords: post.tags.map((t) => t.name), sections: post.categories.map((c) => c.name) }),
          webPageNode({ path, title: post.seo.title || post.title, description: post.seo.description || post.excerpt, image: post.featuredImage, datePublished: post.publishedAt, dateModified: post.contentUpdatedAt, hasBreadcrumb: true }),
          breadcrumbNode(path, crumbs),
          websiteNode(settings),
          organizationNode(settings),
        )}
      />
      <article>
        <header className="bg-paper-warm">
          <Container size="narrow" className="pt-12 pb-10 sm:pt-16">
            <Breadcrumbs crumbs={crumbs} />
            <h1 className="mt-10 text-[2.2rem] leading-[1.12] text-navy-950 sm:text-5xl">{post.title}</h1>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-muted">
              {post.author && (
                <Link href={`/author/${post.author.slug}/`} className="flex items-center gap-3 text-ink hover:text-navy-700">
                  <span className="grid size-10 place-items-center rounded-full bg-navy-900 font-display text-white">{post.author.name.charAt(0)}</span>
                  <span>
                    <span className="block font-medium">{post.author.name}</span>
                    {post.author.role && <span className="block text-xs text-ink-muted">{post.author.role}</span>}
                  </span>
                </Link>
              )}
              <span className="flex items-center gap-2">
                <Icon name="calendar" className="size-4" />
                <time dateTime={post.publishedAt?.toISOString()}>{formatDate(post.publishedAt)}</time>
              </span>
              {updated && <span>Updated {formatDate(updated)}</span>}
              <span className="flex items-center gap-2">
                <Icon name="clock" className="size-4" /> {post.readingMinutes} min read
              </span>
            </div>
          </Container>
        </header>
        {post.featuredImage && (
          <Container size="default" className="-mb-2">
            <div className="relative mx-auto -mt-px aspect-[16/8] max-w-5xl overflow-hidden rounded-b-[1.5rem] bg-navy-100 sm:rounded-[1.5rem] sm:mt-8">
              <Image src={post.featuredImage.url} alt={post.featuredImage.alt || ""} fill priority sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" />
            </div>
          </Container>
        )}
        <Container className="grid gap-12 py-14 lg:grid-cols-12">
          <aside className="order-last lg:order-first lg:col-span-3">
            <div className="lg:sticky lg:top-28 space-y-8">
              {toc.length >= 3 && (
                <nav aria-label="On this page" className="hidden lg:block">
                  <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">On this page</p>
                  <ol className="mt-4 space-y-2 border-l border-line text-sm">
                    {toc.map((t) => (
                      <li key={t.id} className={t.level === 3 ? "pl-7" : "pl-4"}>
                        <a href={`#${t.id}`} className="line-clamp-2 text-ink-muted hover:text-navy-900">
                          {t.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              <ShareLinks url={absoluteUrl(path)} title={post.title} />
            </div>
          </aside>
          <div className="min-w-0 lg:col-span-7">
            <Prose html={html} />
            {post.tags.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <li key={t.slug}>
                    <Link href={`/tag/${t.slug}/`} className="inline-block rounded-full border border-line px-3 py-1 text-sm text-ink-muted hover:border-navy-900 hover:text-navy-900">
                      #{t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-12 rounded-2xl bg-navy-950 p-8 text-white">
              <p className="font-display text-2xl">Need help with this for your business?</p>
              <p className="mt-2 text-white/70">Book a free discovery call and get clear next steps from our lawyers.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/book-appointment/" variant="gold" arrow>
                  Book a free call
                </ButtonLink>
                <ButtonLink href="/contact-us/" variant="light">
                  Contact us
                </ButtonLink>
              </div>
            </div>
            {post.author?.bio && (
              <div className="mt-10 flex gap-5 border-t border-line pt-8">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-navy-900 font-display text-xl text-white">{post.author.name.charAt(0)}</span>
                <div>
                  <p className="text-sm text-ink-muted">Written by</p>
                  <Link href={`/author/${post.author.slug}/`} className="font-display text-xl text-navy-950 hover:text-navy-700">
                    {post.author.name}
                  </Link>
                  <p className="mt-2 text-ink-muted">{post.author.bio}</p>
                </div>
              </div>
            )}
            {comments.length > 0 && (
              <section className="mt-14 border-t border-line pt-10" aria-labelledby="comments">
                <h2 id="comments" className="text-2xl text-navy-950">
                  {post.comments.length} comment{post.comments.length === 1 ? "" : "s"}
                </h2>
                <ol className="mt-8 space-y-8">
                  {comments.map((c) => (
                    <li key={c.id}>
                      <Comment c={c} />
                      {replies(c.id).length > 0 && (
                        <ol className="mt-6 space-y-6 border-l border-line pl-6">
                          {replies(c.id).map((r) => (
                            <li key={r.id}>
                              <Comment c={r} />
                            </li>
                          ))}
                        </ol>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="mt-8 text-sm text-ink-muted">Comments are closed. Questions? <Link className="text-navy-900 underline" href="/contact-us/">Contact us</Link>.</p>
              </section>
            )}
          </div>
        </Container>
      </article>
      {post.related.length > 0 && (
        <section className="border-t border-line bg-paper-warm py-20">
          <Container>
            <h2 className="text-3xl text-navy-950">Related articles</h2>
            <div className="mt-10">
              <PostGrid posts={post.related} />
            </div>
          </Container>
        </section>
      )}
    </>
  );
}

function Comment({ c }: { c: Post["comments"][number] }) {
  return (
    <article>
      <p className="flex items-center gap-2 text-sm">
        <span className="font-medium text-navy-950">{c.authorName}</span>
        {c.isStaffReply && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-700">LexPraxis</span>}
        <span className="text-ink-muted">· {formatDate(c.createdAt)}</span>
      </p>
      <div className="prose-lp mt-2 text-[0.97rem]" dangerouslySetInnerHTML={{ __html: c.html }} />
    </article>
  );
}

// ---------------------------------------------------------------- legal document intake

export async function DocumentView({ doc }: { doc: Doc }) {
  const settings = await getSettings();
  const def = getFormDefinition(doc.formId);
  const path = `/${doc.slug}/`;
  const groupLabel = doc.group === "agreements" ? "Agreements" : "Corporate filings";
  const groupPath = doc.group === "agreements" ? "/legal-forms/" : "/corporate-filings/";
  const crumbs = [{ name: "Home", path: "/" }, { name: "Legal documents", path: "/legal-forms/" }, ...(doc.group === "corporate-filings" ? [{ name: groupLabel, path: groupPath }] : []), { name: doc.title, path }];
  const siblings = (await listDocuments(doc.group)).filter((d) => d.slug !== doc.slug).slice(0, 8);
  const hasUploads = def ? fieldsOf(def).some((f) => f.type === "file") : false;
  return (
    <>
      <JsonLd data={graph(webPageNode({ path, title: doc.seo.title || doc.title, description: doc.seo.description || doc.summary, hasBreadcrumb: true }), breadcrumbNode(path, crumbs), websiteNode(settings), organizationNode(settings), doc.faqs.length ? faqNode(path, doc.faqs) : null)} />
      <PageHeader crumbs={crumbs} eyebrow={groupLabel} title={doc.title} summary={doc.summary} />
      <Container className="grid gap-12 py-14 lg:grid-cols-12 lg:py-20">
        <div className="min-w-0 lg:col-span-8">
          {doc.body && <Prose html={resolveMediaInHtml(sanitizeRichHtml(doc.body))} className="mb-12" />}
          <div className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_30px_60px_-40px_rgba(11,22,48,.35)] sm:p-10">
            {def ? <FormRenderer def={def} /> : <p className="text-ink-muted">This questionnaire is being updated. Please contact us to start your request.</p>}
          </div>
        </div>
        <aside className="lg:col-span-4">
          <div className="space-y-6 lg:sticky lg:top-28">
            <div className="rounded-2xl bg-navy-950 p-7 text-white">
              <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">How it works</p>
              <ol className="mt-5 space-y-4 text-[0.95rem] text-white/80">
                <li className="flex gap-3"><span className="font-display text-gold-300">1</span> Answer the questionnaire{hasUploads ? " and upload any documents" : ""}.</li>
                <li className="flex gap-3"><span className="font-display text-gold-300">2</span> A lawyer reviews your answers and contacts you to confirm details and fees.</li>
                <li className="flex gap-3"><span className="font-display text-gold-300">3</span> We prepare and file or deliver your document.</li>
              </ol>
            </div>
            {doc.requirements.length > 0 && (
              <div className="rounded-2xl border border-line bg-white p-7">
                <p className="font-medium text-navy-950">Have these ready</p>
                <ul className="mt-4 space-y-2 text-sm text-ink-muted">
                  {doc.requirements.map((r) => (
                    <li key={r} className="flex gap-2"><Icon name="check" className="mt-0.5 size-4 shrink-0 text-gold-600" />{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-2xl border border-line bg-white p-7">
              <p className="font-medium text-navy-950">Questions before you start?</p>
              <p className="mt-2 text-sm text-ink-muted">Speak to us first — the discovery call is free.</p>
              <div className="mt-5 grid gap-2">
                <ButtonLink href="/book-appointment/" size="sm">Book a free call</ButtonLink>
                {settings.site.phones[0] && (
                  <a href={`tel:${settings.site.phones[0].replace(/\s+/g, "")}`} className="text-center text-sm text-navy-900 underline">
                    or call {settings.site.phones[0]}
                  </a>
                )}
              </div>
            </div>
            {siblings.length > 0 && (
              <nav aria-label={`Other ${groupLabel.toLowerCase()}`} className="rounded-2xl border border-line bg-white p-7">
                <p className="font-medium text-navy-950">Other {groupLabel.toLowerCase()}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {siblings.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/${s.slug}/`} className="text-ink-muted hover:text-navy-900">{s.title}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </aside>
      </Container>
      {doc.faqs.length > 0 && <FaqBlock block={{ heading: "Frequently asked questions", items: doc.faqs }} />}
    </>
  );
}

// ---------------------------------------------------------------- service

export async function ServiceView({ service }: { service: Svc }) {
  const settings = await getSettings();
  const path = `/service/${service.slug}/`;
  const crumbs = [{ name: "Home", path: "/" }, { name: "Services", path: "/service/" }, { name: service.shortTitle || service.title, path }];
  const others = (await listServices()).filter((s) => s.slug !== service.slug);
  const related = service.related.length ? service.related : others.slice(0, 3);
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title: service.seo.title || service.title, description: service.seo.description || service.summary, hasBreadcrumb: true }),
          breadcrumbNode(path, crumbs),
          websiteNode(settings),
          organizationNode(settings),
          service.faqs.length ? faqNode(path, service.faqs) : null,
        )}
      />
      <PageHeader crumbs={crumbs} eyebrow="Our services" title={service.title} summary={service.summary}>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={service.ctaHref || "/book-appointment/"} size="lg" arrow>
            {service.ctaLabel || "Book a free consultation"}
          </ButtonLink>
          <ButtonLink href="/contact-us/" size="lg" variant="outline">
            Ask a question
          </ButtonLink>
        </div>
      </PageHeader>
      <Container className="grid gap-14 py-16 lg:grid-cols-12 lg:py-20">
        <div className="min-w-0 lg:col-span-8">
          <Prose html={resolveMediaInHtml(withoutLeadingSummary(sanitizeRichHtml(service.body), service.summary))} />
          {service.audience && (
            <div className="mt-12 rounded-2xl bg-paper-warm p-7">
              <h2 className="text-2xl text-navy-950">Who this is for</h2>
              <p className="mt-3 text-ink-muted">{service.audience}</p>
            </div>
          )}
          {service.process.length > 0 && (
            <div className="mt-12">
              <h2 className="text-3xl text-navy-950">How it works</h2>
              <ol className="mt-8 grid gap-6 sm:grid-cols-2">
                {service.process.map((p, i) => (
                  <li key={p.title} className="rounded-2xl border border-line bg-white p-6">
                    <span className="font-display text-3xl text-gold-600">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-3 text-xl text-navy-950">{p.title}</h3>
                    <p className="mt-2 text-[0.95rem] text-ink-muted">{p.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {service.documents.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl text-navy-950">Start online</h2>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {service.documents.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/${d.slug}/`} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 hover:border-navy-900/30">
                      {d.title} <Icon name="arrow-right" className="size-4 text-ink-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <aside className="lg:col-span-4">
          <nav aria-label="All services" className="rounded-2xl border border-line bg-white p-6 lg:sticky lg:top-28">
            <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">All services</p>
            <ul className="mt-4 space-y-1">
              {[{ slug: service.slug, title: service.title, shortTitle: service.shortTitle }, ...others]
                .sort((a, b) => (a.shortTitle || a.title).localeCompare(b.shortTitle || b.title))
                .map((s) => (
                  <li key={s.slug}>
                    <Link href={`/service/${s.slug}/`} aria-current={s.slug === service.slug ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-[0.93rem] ${s.slug === service.slug ? "bg-navy-900 text-white" : "text-ink/80 hover:bg-paper-warm"}`}>
                      {s.shortTitle || s.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </nav>
        </aside>
      </Container>
      {service.faqs.length > 0 && <FaqBlock block={{ heading: "Frequently asked questions", items: service.faqs }} />}
      <section className="bg-paper-warm py-20">
        <Container>
          <h2 className="text-3xl text-navy-950">Related services</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </div>
        </Container>
      </section>
      <CtaBlock block={{ heading: settings.cta.consultationTitle, text: settings.cta.consultationText, primary: { label: "Book a free call", href: "/book-appointment/" }, secondary: { label: "Contact us", href: "/contact-us/" } }} />
    </>
  );
}

// ---------------------------------------------------------------- CMS page

export async function PageView({ page }: { page: Page }) {
  const settings = await getSettings();
  const path = page.path ? `/${page.path}/` : "/";
  const blocks = page.blocks as AnyBlock[];
  const crumbs = [{ name: "Home", path: "/" }, { name: page.title, path }];
  const isHome = page.template === "home";
  const startsWithHero = blocks[0]?.type === "hero";
  const faqs = blocks.filter((b) => b.type === "faq").flatMap((b) => (b.type === "faq" ? b.items : []));
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title: page.seo.title || page.title, description: page.seo.description || page.summary, image: page.featuredImage, hasBreadcrumb: true }),
          breadcrumbNode(path, isHome ? [{ name: "Home", path: "/" }] : crumbs),
          websiteNode(settings),
          organizationNode(settings),
          faqs.length ? faqNode(path, faqs) : null,
        )}
      />
      {!startsWithHero && <PageHeader crumbs={crumbs} title={page.title} summary={page.template === "legal" ? undefined : page.summary} />}
      {page.template === "legal" && (
        <Container size="narrow" className="pt-10 text-sm text-ink-muted">
          Last updated {formatDate(page.updatedAt)}
        </Container>
      )}
      <Blocks blocks={blocks} h1Title={startsWithHero ? page.title : undefined} />
    </>
  );
}

/** The summary is shown in the page header; don't repeat it as the body's first paragraph. */
function withoutLeadingSummary(html: string, summary: string): string {
  const first = html.match(/^\s*<p>([\s\S]*?)<\/p>/);
  if (!first || !summary) return html;
  const text = plainText(first[1]);
  return text.startsWith(summary.replace(/…$/, "").trim().slice(0, 120)) ? html.slice(first[0].length) : html;
}

export function notFoundIfNull<T>(value: T | null): T {
  if (!value) notFound();
  return value;
}
