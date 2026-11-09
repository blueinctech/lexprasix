import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { PostCard as PostCardData } from "@/lib/content/queries";
import type { Crumb } from "@/lib/seo";
import { Icon } from "@/components/ui/Icon";
import { Container, formatDate } from "@/components/ui/primitives";

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

/**
 * Inner-page title band, as on the WordPress theme: light grey band, centred
 * navy title (the page's single H1) and the breadcrumb trail in gold below it.
 * The "Home" crumb is kept for structured data but not shown, like the theme.
 */
export function PageHeader({ crumbs, title, children }: { crumbs: Crumb[]; eyebrow?: string; title: string; summary?: string; children?: ReactNode; tone?: "paper" | "navy" }) {
  const visible = crumbs.filter((c) => c.path !== "/");
  return (
    <section className="bg-band">
      <Container className="flex min-h-[20rem] flex-col items-center justify-center py-20 text-center sm:min-h-[31.75rem]">
        <h1 className="max-w-6xl text-[2.5rem] leading-[1.1] font-semibold text-navy-700 sm:text-5xl lg:text-[4rem]">{title}</h1>
        <nav aria-label="Breadcrumb" className="mt-5">
          <ol className="flex flex-wrap items-center justify-center gap-2 text-base">
            {visible.map((c, i) => (
              <li key={c.path} className="flex items-center gap-2">
                {i > 0 && <Icon name="chevron-right" className="size-3.5 text-ink-muted" />}
                {i < visible.length - 1 ? (
                  <Link href={c.path} className="text-ink hover:text-gold-500">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-gold-500">
                    {c.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
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

/** Article card used on the homepage and archives (bordered, navy base line, uppercase title). */
export function PostCard({ post, priority = false }: { post: PostCardData; priority?: boolean }) {
  return (
    <article className="group relative flex h-full flex-col rounded-[1.25rem] border border-b-[5px] border-navy-700/70 bg-white p-5">
      <div className="relative aspect-[380/291] overflow-hidden rounded-[1.25rem] bg-paper-warm">
        {post.image ? (
          <Image src={post.image.url} alt={post.image.alt || ""} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" {...(priority ? { loading: "eager" as const } : {})} className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        ) : (
          <div className="grid h-full place-items-center bg-navy-700 text-gold-300">
            <Icon name="scale" className="size-10" />
          </div>
        )}
      </div>
      <PostMeta post={post} className="mt-6 px-7 text-[0.875rem]" />
      {/* The theme shows the first six words of the title; the full title stays available to screen readers. */}
      <h3 className="mt-4 px-7 pb-6 text-2xl leading-[1.42] font-semibold text-heading uppercase">
        <Link href={`/${post.slug}/`} className="after:absolute after:inset-0 hover:text-gold-500">
          <span aria-hidden="true">{excerptWords(post.title, 6)}</span>
          <span className="sr-only">{post.title}</span>
        </Link>
      </h3>
    </article>
  );
}

/** "By Author | date | N Comments" line with the theme's gold icons. */
export function PostMeta({ post, className = "" }: { post: { author: { name: string } | null; publishedAt: Date | null; commentCount?: number }; className?: string }) {
  const items = [
    post.author && { icon: "user", text: `By ${post.author.name}` },
    post.publishedAt && { icon: "calendar", text: formatDate(post.publishedAt) },
    post.commentCount !== undefined && { icon: "comment", text: `${post.commentCount} Comment${post.commentCount === 1 ? "" : "s"}` },
  ].filter(Boolean) as { icon: string; text: string }[];
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-ink ${className}`}>
      {items.map((m, i) => (
        <li key={m.icon} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true" className="mr-1.5 h-4 w-px bg-line" />}
          <Icon name={m.icon} className="size-4 text-gold-500" />
          {m.text}
        </li>
      ))}
    </ul>
  );
}

export function PostGrid({ posts }: { posts: PostCardData[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p, i) => (
        <PostCard key={p.slug} post={p} priority={i < 3} />
      ))}
    </div>
  );
}

/** First n words, cut without an ellipsis like the theme's excerpts. */
function excerptWords(text: string, n: number) {
  const words = text.trim().split(/\s+/);
  return words.length <= n ? text : words.slice(0, n).join(" ");
}

/** Theme service card: centred icon, Lora title, summary, "Read More", gold base line. */
export function ServiceCard({ service }: { service: { slug: string; title: string; shortTitle?: string; summary: string; icon: string }; index?: number }) {
  const iconIsImage = service.icon.startsWith("/");
  return (
    <article className="group relative flex h-full flex-col items-center rounded-[1.25rem] border-b-[6px] border-gold-500 bg-white px-8 pt-8 pb-7 text-center shadow-[0_10px_30px_-12px_rgba(0,0,0,.12)] transition-transform duration-300 hover:-translate-y-1">
      <span className="grid size-20 place-items-center rounded-full bg-navy-700 text-white shadow-[0_0_8px_rgba(0,0,0,.05)] transition-colors duration-400 group-hover:bg-gold-500">
        {iconIsImage ? (
          <Image src={service.icon} alt="" width={48} height={48} className="size-12 object-contain brightness-0 invert transition-transform duration-400 group-hover:[transform:rotateY(180deg)]" />
        ) : (
          <Icon name={service.icon || "scale"} className="size-9" />
        )}
      </span>
      <h3 className="mt-5 text-2xl leading-[1.42] font-semibold text-heading">
        <Link href={`/service/${service.slug}/`} className="after:absolute after:inset-0 group-hover:text-gold-500">
          {service.shortTitle || service.title}
        </Link>
      </h3>
      <p className="mt-4 flex-1 leading-[1.75] text-ink">{excerptWords(service.summary, 20)}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-[0.875rem] font-medium text-heading group-hover:text-gold-500">
        Read More <Icon name="arrow-right" className="size-4" />
      </span>
    </article>
  );
}

export function DocumentCard({ doc }: { doc: { slug: string; title: string; summary: string; group: string } }) {
  return (
    <Link href={`/${doc.slug}/`} className="group flex items-center justify-between gap-4 rounded-full border border-line bg-white px-6 py-4 transition-colors hover:border-gold-500">
      <span className="font-medium text-heading">{doc.title}</span>
      <Icon name="arrow-right" className="size-4 shrink-0 text-ink transition-transform group-hover:translate-x-0.5 group-hover:text-gold-500" />
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
        <Link href={href(page - 1)} rel="prev" className="grid size-12 place-items-center rounded-full bg-paper-warm text-heading hover:bg-gold-500 hover:text-white">
          <Icon name="chevron-left" className="size-4" label="Previous page" />
        </Link>
      )}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`grid size-12 place-items-center rounded-full text-sm font-medium ${n === page ? "bg-gold-500 text-white" : "bg-paper-warm text-heading hover:bg-gold-500 hover:text-white"}`}>
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className="grid size-12 place-items-center rounded-full bg-paper-warm text-heading hover:bg-gold-500 hover:text-white">
          <Icon name="chevron-right" className="size-4" label="Next page" />
        </Link>
      )}
    </nav>
  );
}
