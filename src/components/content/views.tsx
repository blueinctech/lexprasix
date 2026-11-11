import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AnyBlock } from "@/lib/blocks";
import {
  getDocument,
  getPageByPath,
  getPost,
  getService,
  getSettings,
  listServices,
  resolveMediaInHtml,
} from "@/lib/content/queries";
import { addHeadingIds, sanitizeRichHtml } from "@/lib/sanitize";
import {
  absoluteUrl,
  articleNode,
  breadcrumbNode,
  faqNode,
  graph,
  organizationNode,
  webPageNode,
  websiteNode,
} from "@/lib/seo";
import { getFormDefinition } from "@/forms/registry";
import { Blocks, FaqBlock } from "@/components/blocks/Blocks";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, Container, formatDate } from "@/components/ui/primitives";
import { BlogSidebar } from "./blog";
import { JsonLd, PageHeader, PostMeta, Prose } from "./common";
import { CommentForm, ReplyButton } from "./CommentForm";
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
  const { html } = addHeadingIds(sanitizeRichHtml(post.html));
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog/" },
    { name: post.title, path },
  ];
  const comments = post.comments.filter((c) => !c.parentId);
  const replies = (id: string) =>
    post.comments.filter((c) => c.parentId === id);
  return (
    <>
      <JsonLd
        data={graph(
          articleNode({
            path,
            title: post.title,
            description: post.seo.description || post.excerpt,
            image: post.featuredImage,
            datePublished: post.publishedAt ?? new Date(),
            dateModified:
              post.contentUpdatedAt ?? post.publishedAt ?? new Date(),
            author: post.author,
            keywords: post.tags.map((t) => t.name),
            sections: post.categories.map((c) => c.name),
          }),
          webPageNode({
            path,
            title: post.seo.title || post.title,
            description: post.seo.description || post.excerpt,
            image: post.featuredImage,
            datePublished: post.publishedAt,
            dateModified: post.contentUpdatedAt,
            hasBreadcrumb: true,
          }),
          breadcrumbNode(path, crumbs),
          websiteNode(settings),
          organizationNode(settings),
        )}
      />
      <PageHeader crumbs={crumbs} title={post.title} />
      <Container className="grid gap-10 py-20 lg:grid-cols-[1fr_26.75rem] lg:py-[7.5rem]">
        <article className="min-w-0 rounded-[1.25rem] border border-[#e6e6e6] bg-white p-6 sm:p-10">
          {post.featuredImage && (
            <div className="relative mb-10 aspect-[774/430] overflow-hidden rounded-[1.25rem] bg-paper-warm">
              <Image
                src={post.featuredImage.url}
                alt={post.featuredImage.alt || ""}
                fill
                priority
                sizes="(min-width: 1024px) 774px, 100vw"
                className="object-cover"
              />
            </div>
          )}
          <PostMeta
            post={{
              author: post.author,
              publishedAt: post.publishedAt,
              commentCount: post.comments.length,
            }}
            className="text-[0.875rem]"
          />
          <Prose html={html} className="mt-4" />
          <div className="mt-12 flex flex-wrap items-center justify-between gap-6 border-t border-[#e6e6e6] pt-8">
            {post.tags.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/tag/${t.slug}/`}
                      className="inline-block rounded-full bg-paper-warm px-4 py-1.5 text-[0.875rem] text-heading hover:bg-gold-500 hover:text-white"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <span />
            )}
            <ShareLinks url={absoluteUrl(path)} title={post.title} />
          </div>
          {post.author?.bio && (
            <div className="mt-10 flex gap-5 rounded-[1.25rem] bg-paper-warm p-6">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-navy-700 font-display text-xl text-white">
                {post.author.name.charAt(0)}
              </span>
              <div>
                <Link
                  href={`/author/${post.author.slug}/`}
                  className="font-display text-xl font-semibold text-heading hover:text-gold-500"
                >
                  {post.author.name}
                </Link>
                <p className="mt-2 text-ink">{post.author.bio}</p>
              </div>
            </div>
          )}
          {(comments.length > 0 || post.commentsOpen) && (
            <section
              className="mt-14 border-t border-[#e6e6e6] pt-10"
              aria-labelledby="comments"
            >
              {comments.length > 0 && (
                <h2 id="comments" className="text-[1.75rem] font-semibold">
                  {post.comments.length} Comment
                  {post.comments.length === 1 ? "" : "s"}
                </h2>
              )}
              <ol className="mt-8 space-y-8">
                {comments.map((c) => (
                  <li key={c.id}>
                    <Comment c={c} />
                    {post.commentsOpen && <ReplyButton id={c.id} name={c.authorName} />}
                    {replies(c.id).length > 0 && (
                      <ol className="mt-6 space-y-6 border-l border-[#e6e6e6] pl-6">
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
              {post.commentsOpen ? (
                <CommentForm postId={post.id} />
              ) : (
              <p className="mt-8 text-[0.875rem] text-ink">
                Comments are closed. Questions?{" "}
                <Link
                  className="text-heading underline hover:text-gold-500"
                  href="/contact-us/"
                >
                  Contact us
                </Link>
                .
              </p>
              )}
            </section>
          )}
        </article>
        <BlogSidebar />
      </Container>
    </>
  );
}

function Comment({ c }: { c: Post["comments"][number] }) {
  return (
    <article className="rounded-[1.25rem] bg-paper-warm p-6">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg font-semibold text-heading">
          {c.authorName}
        </span>
        {c.isStaffReply && (
          <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-xs text-white">
            LexPraxis
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[0.875rem] text-ink">
          <Icon name="calendar" className="size-4 text-gold-500" />
          {formatDate(c.createdAt)}
        </span>
      </p>
      <div
        className="prose-lp mt-3"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(c.html) }}
      />
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
  const crumbs = [{ name: "Home", path: "/" }, { name: "Legal Forms", path: "/legal-forms/" }, ...(doc.group === "corporate-filings" ? [{ name: groupLabel, path: groupPath }] : []), { name: doc.title, path }];
  return (
    <>
      <JsonLd data={graph(webPageNode({ path, title: doc.seo.title || doc.title, description: doc.seo.description || doc.summary, hasBreadcrumb: true }), breadcrumbNode(path, crumbs), websiteNode(settings), organizationNode(settings), doc.faqs.length ? faqNode(path, doc.faqs) : null)} />
      {/* The theme's title band shows only the current page in the trail; the full trail stays in structured data. */}
      <PageHeader crumbs={[crumbs[0], crumbs[crumbs.length - 1]]} title={doc.title} />
      <Container className="py-20 lg:py-[7.5rem]">
        {doc.body && <Prose html={resolveMediaInHtml(sanitizeRichHtml(doc.body))} className="mb-12" />}
        <div className="rounded-[2.5rem] border border-[#8a8a8a]/60 bg-[#f7f7f7] px-5 py-10 sm:px-14 sm:py-14">
          <h2 className="text-[1.6rem] leading-[1.3] text-[#000080] sm:text-[1.75rem]">Kindly fill out this form, and we will get in touch with you shortly.</h2>
          {doc.requirements.length > 0 && (
            <div className="mt-6">
              <p className="font-semibold text-heading">Have these ready:</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {doc.requirements.map((r) => (
                  <li key={r} className="flex gap-2 text-ink">
                    <Icon name="check" className="mt-1 size-4 shrink-0 text-gold-500" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-10">{def ? <FormRenderer def={def} /> : <p className="text-ink">This questionnaire is being updated. Please contact us to start your request.</p>}</div>
        </div>
      </Container>
      {doc.faqs.length > 0 && <FaqBlock block={{ heading: "Frequently asked questions", items: doc.faqs }} />}
    </>
  );
}

// ---------------------------------------------------------------- service

export async function ServiceView({ service }: { service: Svc }) {
  const settings = await getSettings();
  const path = `/service/${service.slug}/`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Service", path: "/service/" },
    { name: service.title, path },
  ];
  const all = await listServices();
  // Include the service itself when previewing a draft that isn't listed yet.
  const list = all.some((s) => s.slug === service.slug)
    ? all
    : [...all, { slug: service.slug, title: service.title }];
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path,
            title: service.seo.title || service.title,
            description: service.seo.description || service.summary,
            hasBreadcrumb: true,
          }),
          breadcrumbNode(path, crumbs),
          websiteNode(settings),
          organizationNode(settings),
          service.faqs.length ? faqNode(path, service.faqs) : null,
        )}
      />
      <PageHeader crumbs={crumbs} title={service.title} />
      {/* Theme layout: the service text on the left, the numbered "All Services" list on the right. */}
      <Container className="grid gap-12 py-20 lg:grid-cols-[1fr_26rem] lg:gap-12 lg:py-[7.5rem]">
        <div className="min-w-0">
          <Prose
            html={resolveMediaInHtml(
              sanitizeRichHtml(service.body || `<p>${service.summary}</p>`),
            )}
          />
          {service.audience && (
            <div className="mt-12 rounded-[1.25rem] bg-paper-warm p-8">
              <h2 className="text-2xl">Who this is for</h2>
              <p className="mt-3 text-ink">{service.audience}</p>
            </div>
          )}
          {service.process.length > 0 && (
            <div className="mt-12">
              <h2 className="text-3xl">How it works</h2>
              <ol className="mt-8 grid gap-6 sm:grid-cols-2">
                {service.process.map((p, i) => (
                  <li
                    key={p.title}
                    className="rounded-[1.25rem] border-b-[6px] border-gold-500 bg-white p-6 shadow-[0_10px_30px_-12px_rgba(0,0,0,.12)]"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-gold-500 font-medium text-white">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-4 text-xl">{p.title}</h3>
                    <p className="mt-2 text-ink">{p.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {service.documents.length > 0 && (
            <div className="mt-12">
              <h2 className="text-2xl">Start online</h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {service.documents.map((d) => (
                  <li key={d.slug}>
                    <Link
                      href={`/${d.slug}/`}
                      className="flex items-center justify-between rounded-full bg-paper-warm px-6 py-3.5 text-heading hover:text-gold-500"
                    >
                      {d.title} <Icon name="arrow-right" className="size-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {service.ctaHref && service.ctaHref !== "/book-appointment/" && (
            <div className="mt-10">
              <ButtonLink href={service.ctaHref} arrow>
                {service.ctaLabel || "Book a free consultation"}
              </ButtonLink>
            </div>
          )}
        </div>
        <aside>
          <nav
            aria-label="All services"
            className="rounded-[1.25rem] bg-paper-warm p-6 sm:p-10"
          >
            <h2 className="text-2xl font-semibold">All Services</h2>
            <ol className="mt-6 space-y-3.5">
              {list.map((s, i) => (
                <li key={s.slug}>
                  <Link
                    href={`/service/${s.slug}/`}
                    aria-current={s.slug === service.slug ? "page" : undefined}
                    className={`flex items-center justify-between gap-3 rounded-[1.875rem] bg-white px-[1.875rem] py-3.5 text-base leading-[1.35] transition-colors hover:bg-gold-500 hover:text-white ${s.slug === service.slug ? "text-gold-500" : "text-heading"}`}
                  >
                    <span>
                      {i + 1}. {s.title}
                    </span>
                    <Icon name="arrow-right" className="size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      </Container>
      {service.faqs.length > 0 && (
        <FaqBlock
          block={{ heading: "Frequently asked questions", items: service.faqs }}
        />
      )}
    </>
  );
}

export async function PageView({ page }: { page: Page }) {
  const settings = await getSettings();
  const path = page.path ? `/${page.path}/` : "/";
  const blocks = page.blocks as AnyBlock[];
  const crumbs = [
    { name: "Home", path: "/" },
    { name: page.title, path },
  ];
  const isHome = page.template === "home";
  const startsWithHero = blocks[0]?.type === "hero";
  const faqs = blocks
    .filter((b) => b.type === "faq")
    .flatMap((b) => (b.type === "faq" ? b.items : []));
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({
            path,
            title: page.seo.title || page.title,
            description: page.seo.description || page.summary,
            image: page.featuredImage,
            hasBreadcrumb: true,
          }),
          breadcrumbNode(path, isHome ? [{ name: "Home", path: "/" }] : crumbs),
          websiteNode(settings),
          organizationNode(settings),
          faqs.length ? faqNode(path, faqs) : null,
        )}
      />
      {!startsWithHero && (
        <PageHeader
          crumbs={crumbs}
          title={page.title}
          summary={page.template === "legal" ? undefined : page.summary}
        />
      )}
      {page.template === "legal" && (
        <Container size="narrow" className="pt-10 text-sm text-ink-muted">
          Last updated {formatDate(page.updatedAt)}
        </Container>
      )}
      <Blocks
        blocks={blocks}
        h1Title={startsWithHero ? page.title : undefined}
      />
    </>
  );
}

export function notFoundIfNull<T>(value: T | null): T {
  if (!value) notFound();
  return value;
}
