import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { blogSidebar, type PostCard } from "@/lib/content/queries";
import { Icon } from "@/components/ui/Icon";
import { PostMeta } from "./common";

// Blog list cards and sidebar widgets, styled after the WordPress (Ensaf) theme.

/** Large card used on the blog and archive lists: image, meta, title, excerpt, "Read More". */
export function BlogListCard({ post, priority = false }: { post: PostCard; priority?: boolean }) {
  return (
    <article className="rounded-[1.25rem] border border-[#e6e6e6] bg-white p-6 sm:p-10">
      {post.image && (
        <Link href={`/${post.slug}/`} className="relative mb-10 block aspect-[774/430] overflow-hidden rounded-[1.25rem] bg-paper-warm" tabIndex={-1} aria-hidden="true">
          <Image src={post.image.url} alt="" fill sizes="(min-width: 1024px) 774px, 100vw" {...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : {})} className="object-cover transition-transform duration-700 hover:scale-[1.03]" />
        </Link>
      )}
      <PostMeta post={post} className="text-[0.875rem]" />
      <h2 className="mt-3 text-[1.75rem] leading-[1.3] font-semibold uppercase sm:text-[2rem]">
        <Link href={`/${post.slug}/`} className="hover:text-gold-500">
          {post.title}
        </Link>
      </h2>
      {post.excerpt && <p className="mt-6 line-clamp-2 leading-[1.75] text-ink">{post.excerpt}</p>}
      <Link href={`/${post.slug}/`} className="mt-5 inline-flex items-center gap-2 text-[0.875rem] font-medium text-heading hover:text-gold-500">
        Read More <Icon name="arrow-right" className="size-4" />
        <span className="sr-only">: {post.title}</span>
      </Link>
    </article>
  );
}

function Widget({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.25rem] bg-paper-warm p-6 sm:p-10">
      {title && (
        <h2 className="relative pb-4 text-2xl font-semibold after:absolute after:bottom-0 after:left-0 after:h-[3px] after:w-full after:rounded after:bg-[#dedede] before:absolute before:bottom-0 before:left-0 before:z-10 before:h-[3px] before:w-10 before:rounded before:bg-gold-500">
          {title}
        </h2>
      )}
      <div className={title ? "mt-8" : ""}>{children}</div>
    </section>
  );
}

export function BlogSearch({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/blog/search/" role="search" className="flex items-center rounded-full bg-white shadow-[0_6px_16px_-10px_rgba(0,0,0,.15)]">
      <label htmlFor="sidebar-q" className="sr-only">
        Search articles
      </label>
      <input id="sidebar-q" name="q" type="search" defaultValue={defaultValue} placeholder="Enter Keyword" className="h-14 min-w-0 flex-1 rounded-full bg-transparent px-6 text-[0.875rem] outline-none placeholder:text-ink" />
      <button type="submit" className="grid size-14 shrink-0 place-items-center rounded-full bg-gold-500 text-white transition-colors hover:bg-navy-700">
        <Icon name="search" className="size-5" label="Search" />
      </button>
    </Form>
  );
}

/** Search, recent posts, recent comments and categories. */
export async function BlogSidebar({ query = "" }: { query?: string }) {
  const { recentPosts, recentComments, categories } = await blogSidebar();
  return (
    <aside className="space-y-10">
      <Widget title="Search">
        <BlogSearch defaultValue={query} />
      </Widget>
      {recentPosts.length > 0 && (
        <Widget title="Recent Posts">
          <ul className="space-y-4">
            {recentPosts.map((p) => (
              <li key={p.slug}>
                <Link href={`/${p.slug}/`} className="block leading-[1.6] text-heading uppercase hover:text-gold-500">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </Widget>
      )}
      {recentComments.length > 0 && (
        <Widget title="Recent Comments">
          <ul className="divide-y divide-[#dedede]">
            {recentComments.map((c) => (
              <li key={c.id} className="flex gap-3 py-5 first:pt-0 last:pb-0">
                <Icon name="comment" className="mt-1 size-5 shrink-0 text-gold-500" />
                <p className="leading-[1.5] text-heading">
                  {c.authorName} on{" "}
                  <Link href={`/${c.postSlug}/#comments`} className="uppercase hover:text-gold-500">
                    {c.postTitle}
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        </Widget>
      )}
      {categories.length > 0 && (
        <Widget title="Categories">
          <ul className="space-y-3">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}/`} className="flex items-center justify-between gap-3 rounded-full bg-white px-6 py-3.5 text-heading transition-colors hover:bg-gold-500 hover:text-white">
                  <span>{c.name}</span>
                  <span className="text-[0.875rem]">({c.n})</span>
                </Link>
              </li>
            ))}
          </ul>
        </Widget>
      )}
    </aside>
  );
}
