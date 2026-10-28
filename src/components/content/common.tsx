import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PostCard as PostCardData } from "@/lib/content/queries";
import type { Crumb } from "@/lib/seo";
import { Icon } from "@/components/ui/Icon";
import { Container, Eyebrow, formatDate } from "@/components/ui/primitives";

export function JsonLd({ data }: { data: unknown }) {
  // JSON.stringify output is safe in a script tag once "<" is escaped.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function Breadcrumbs({ crumbs, light = false }: { crumbs: Crumb[]; light?: boolean }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={`flex flex-wrap items-center gap-1.5 text-sm ${light ? "text-white/60" : "text-ink-muted"}`}>
        {crumbs.map((c, i) => (
          <li key={c.path} className="flex items-center gap-1.5">
            {i > 0 && <Icon name="chevron-right" className="size-3.5 opacity-60" />}
            {i < crumbs.length - 1 ? (
              <Link href={c.path} className={light ? "hover:text-white" : "hover:text-navy-900"}>
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className={`line-clamp-1 ${light ? "text-white/85" : "text-ink"}`}>
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Inner-page header: breadcrumbs, optional eyebrow, the page's single H1 and summary. */
export function PageHeader({ crumbs, eyebrow, title, summary, children, tone = "paper" }: { crumbs: Crumb[]; eyebrow?: string; title: string; summary?: string; children?: ReactNode; tone?: "paper" | "navy" }) {
  const navy = tone === "navy";
  return (
    <section className={`relative overflow-hidden ${navy ? "bg-navy-950 text-white" : "bg-paper-warm"}`}>
      <Watermark light={navy} />
      <Container className="relative py-14 sm:py-20">
        <Breadcrumbs crumbs={crumbs} light={navy} />
        {eyebrow && <Eyebrow light={navy} className="mt-10">{eyebrow}</Eyebrow>}
        <h1 className={`${eyebrow ? "mt-4" : "mt-10"} max-w-4xl text-4xl sm:text-5xl lg:text-[3.5rem] ${navy ? "text-white" : "text-navy-950"}`}>{title}</h1>
        {summary && <p className={`mt-5 max-w-2xl text-lg leading-relaxed ${navy ? "text-white/75" : "text-ink-muted"}`}>{summary}</p>}
        {children}
      </Container>
    </section>
  );
}

/** Faint shield outline used as a background motif. */
export function Watermark({ light = false, className = "-right-24 -top-10 h-[34rem]" }: { light?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={`pointer-events-none absolute w-auto ${className} ${light ? "text-white/[.04]" : "text-navy-900/[.04]"}`} aria-hidden="true">
      <path d="M32 3 6 11v22c0 17.5 11.2 30.4 26 36 14.8-5.6 26-18.5 26-36V11L32 3Z" fill="none" stroke="currentColor" strokeWidth=".6" />
      <path d="M32 9.5 12 15.6v17.2c0 13.6 8.4 23.8 20 28.6 11.6-4.8 20-15 20-28.6V15.6L32 9.5Z" fill="none" stroke="currentColor" strokeWidth=".4" />
    </svg>
  );
}

export function Prose({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`prose-lp ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function PostCard({ post, priority = false }: { post: PostCardData; priority?: boolean }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-navy-100">
        {post.image ? (
          <Image src={post.image.url} alt={post.image.alt || ""} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" priority={priority} className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center bg-navy-900 text-gold-300">
            <Icon name="scale" className="size-10" />
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3 text-xs text-ink-muted">
        {post.category && <span className="font-semibold tracking-[0.14em] text-gold-700 uppercase">{post.category.name}</span>}
        <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
        <span aria-hidden="true">·</span>
        <span>{post.readingMinutes} min read</span>
      </div>
      <h3 className="mt-2 font-display text-xl leading-snug text-navy-950">
        <Link href={`/${post.slug}/`} className="after:absolute after:inset-0 hover:text-navy-700">
          {post.title}
        </Link>
      </h3>
      {post.excerpt && <p className="mt-2 line-clamp-3 text-[0.95rem] text-ink-muted">{post.excerpt}</p>}
    </article>
  );
}

export function PostGrid({ posts }: { posts: PostCardData[] }) {
  return (
    <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p, i) => (
        <PostCard key={p.slug} post={p} priority={i < 3} />
      ))}
    </div>
  );
}

export function ServiceCard({ service, index }: { service: { slug: string; title: string; shortTitle?: string; summary: string; icon: string }; index?: number }) {
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-white p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-navy-900/20 hover:shadow-[0_24px_50px_-28px_rgba(11,22,48,.35)]">
      <div className="flex items-start justify-between">
        <span className="grid size-12 place-items-center rounded-xl bg-navy-50 text-navy-700 transition-colors group-hover:bg-navy-900 group-hover:text-gold-300">
          <Icon name={service.icon || "scale"} className="size-6" />
        </span>
        {index !== undefined && <span className="font-display text-sm text-ink-muted">{String(index + 1).padStart(2, "0")}</span>}
      </div>
      <h3 className="mt-6 font-display text-[1.35rem] leading-snug text-navy-950">
        <Link href={`/service/${service.slug}/`} className="after:absolute after:inset-0">
          {service.shortTitle || service.title}
        </Link>
      </h3>
      <p className="mt-3 line-clamp-3 flex-1 text-[0.95rem] text-ink-muted">{service.summary}</p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-navy-900 group-hover:text-gold-700">
        Learn more <Icon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </article>
  );
}

export function DocumentCard({ doc }: { doc: { slug: string; title: string; summary: string; group: string } }) {
  return (
    <Link href={`/${doc.slug}/`} className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-white px-5 py-4 transition-colors hover:border-navy-900/25 hover:bg-navy-50/40">
      <span className="flex items-center gap-3">
        <Icon name={doc.group === "agreements" ? "contract" : "file-text"} className="size-5 shrink-0 text-gold-700" />
        <span className="font-medium text-navy-950">{doc.title}</span>
      </span>
      <Icon name="arrow-right" className="size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-navy-900" />
    </Link>
  );
}

export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`);
  const nums = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className="grid size-11 place-items-center rounded-full border border-line hover:border-navy-900">
          <Icon name="chevron-left" className="size-4" label="Previous page" />
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`grid size-11 place-items-center rounded-full text-sm ${n === page ? "bg-navy-900 text-white" : "border border-line hover:border-navy-900"}`}>
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className="grid size-11 place-items-center rounded-full border border-line hover:border-navy-900">
          <Icon name="chevron-right" className="size-4" label="Next page" />
        </Link>
      )}
    </nav>
  );
}
