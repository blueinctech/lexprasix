import type { Metadata } from "next";
import Form from "next/form";
import { notFound } from "next/navigation";
import { getAuthor, getPageByPath, getSettings, getTerm, listPosts } from "@/lib/content/queries";
import { breadcrumbNode, buildMetadata, graph, organizationNode, webPageNode, websiteNode, type Crumb } from "@/lib/seo";
import { Icon } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";
import { JsonLd, PageHeader, Pagination, PostGrid } from "./common";

// Blog index and category / tag / author archives, paginated at /…/page/N/ as on WordPress.

export type ArchiveKind = "blog" | "category" | "tag" | "author";

async function describe(kind: ArchiveKind, slug?: string) {
  if (kind === "blog") {
    const page = await getPageByPath("blog");
    return { title: page?.title ?? "Blog", summary: page?.summary ?? "", seo: page?.seo ?? {}, base: "/blog/", eyebrow: "Insights", filter: {} };
  }
  if (kind === "author") {
    const a = await getAuthor(slug!);
    if (!a) return null;
    return { title: a.name, summary: a.bio || `Articles by ${a.name}.`, seo: a.seo, base: `/author/${a.slug}/`, eyebrow: "Author", filter: { author: a.slug } };
  }
  const term = await getTerm(kind, slug!);
  if (!term) return null;
  return {
    title: kind === "tag" ? `#${term.name}` : term.name,
    summary: term.description || (kind === "category" ? `Articles about ${term.name.toLowerCase()} for businesses in Nigeria.` : `Articles tagged ${term.name}.`),
    seo: term.seo,
    base: `/${kind}/${term.slug}/`,
    eyebrow: kind === "category" ? "Category" : "Topic",
    filter: kind === "category" ? { category: term.slug } : { tag: term.slug },
  };
}

/** "2".."1000" → number; anything else → null (404). Page 1 lives at the base URL. */
export function parsePage(n: string | undefined): number | null {
  if (n === undefined) return 1;
  if (!/^\d+$/.test(n)) return null;
  const page = Number(n);
  return page >= 2 && page <= 1000 ? page : null;
}

export async function archiveMetadata(kind: ArchiveKind, slug: string | undefined, page: number): Promise<Metadata> {
  const [settings, info] = await Promise.all([getSettings(), describe(kind, slug)]);
  if (!info) return {};
  const path = page > 1 ? `${info.base}page/${page}/` : info.base;
  // Yoast titles for archives were "{Name} Archives - Lexpraxis Solicitors".
  const title = kind === "blog" ? info.title : `${info.title.replace(/^#/, "")} Archives`;
  // Yoast titled author archives "{Name}, Author at {Site}".
  const absoluteTitle = kind === "author" ? `${info.title}, Author at ${settings.seo.titleSuffix.replace(/^\s*-\s*/, "")}${page > 1 ? ` - Page ${page}` : ""}` : undefined;
  return buildMetadata({ settings, path, title: page > 1 ? `${title} - Page ${page}` : title, absoluteTitle, description: info.summary, seo: page > 1 ? {} : info.seo });
}

export async function Archive({ kind, slug, page }: { kind: ArchiveKind; slug?: string; page: number }) {
  const [settings, info] = await Promise.all([getSettings(), describe(kind, slug)]);
  if (!info) notFound();
  const result = await listPosts(page, info.filter);
  if (page > result.pages || (page > 1 && !result.items.length)) notFound();
  const path = page > 1 ? `${info.base}page/${page}/` : info.base;
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    ...(kind === "blog" ? [] : [{ name: "Blog", path: "/blog/" }]),
    { name: info.title, path: info.base },
    ...(page > 1 ? [{ name: `Page ${page}`, path }] : []),
  ];
  return (
    <>
      <JsonLd
        data={graph(
          webPageNode({ path, title: info.title, description: info.summary, type: kind === "author" ? "ProfilePage" : ["WebPage", "CollectionPage"], hasBreadcrumb: true }),
          breadcrumbNode(path, crumbs),
          websiteNode(settings),
          organizationNode(settings),
        )}
      />
      <PageHeader crumbs={crumbs} eyebrow={info.eyebrow} title={page > 1 ? `${info.title} — page ${page}` : info.title} summary={page > 1 ? undefined : info.summary}>
        {kind === "blog" && <SearchBox />}
        <p className="mt-6 text-sm text-ink-muted">
          {result.total} article{result.total === 1 ? "" : "s"}
        </p>
      </PageHeader>
      <Container className="py-16 sm:py-20">
        <PostGrid posts={result.items} />
        <Pagination page={page} pages={result.pages} base={info.base} />
      </Container>
    </>
  );
}

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <Form action="/blog/search/" role="search" className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-line bg-white p-1.5 pl-5 focus-within:border-navy-700">
      <Icon name="search" className="size-5 shrink-0 text-ink-muted" />
      <label htmlFor="blog-q" className="sr-only">
        Search articles
      </label>
      <input id="blog-q" name="q" type="search" defaultValue={defaultValue} placeholder="Search articles, e.g. trademark registration" className="h-10 min-w-0 flex-1 bg-transparent text-[0.97rem] outline-none placeholder:text-ink-muted/70" />
      <button type="submit" className="h-10 shrink-0 rounded-full bg-navy-900 px-5 text-sm font-medium text-white hover:bg-navy-700">
        Search
      </button>
    </Form>
  );
}
