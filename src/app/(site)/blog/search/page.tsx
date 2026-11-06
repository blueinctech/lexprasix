import type { Metadata } from "next";
import { Suspense } from "react";
import { BlogListCard, BlogSidebar } from "@/components/content/blog";
import { PageHeader } from "@/components/content/common";
import { Container } from "@/components/ui/primitives";
import { listPosts } from "@/lib/content/queries";

// Search results are per-request and not indexed.
export const metadata: Metadata = { title: { absolute: "Search articles - Lexpraxis Solicitors" }, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string }> };

async function Results({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  if (!q) return <p className="text-ink">Type a few words in the search box to search the blog.</p>;
  const { items, total } = await listPosts(1, { q });
  return (
    <>
      <p className="text-ink">
        {total} result{total === 1 ? "" : "s"} for “{q}”{total > items.length ? ` (showing the ${items.length} most recent)` : ""}
      </p>
      {items.length ? items.map((p, i) => <BlogListCard key={p.slug} post={p} priority={i === 0} />) : <p className="text-ink">No articles matched. Try different words or browse the blog.</p>}
    </>
  );
}

export default function SearchPage(props: Props) {
  return (
    <>
      <PageHeader crumbs={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog/" }, { name: "Search", path: "/blog/search/" }]} title="Search Articles" />
      <Container className="grid gap-10 py-20 lg:grid-cols-[1fr_26.75rem] lg:py-[7.5rem]">
        <div className="min-w-0 space-y-10">
          <Suspense fallback={<p className="text-ink">Searching…</p>}>
            <Results {...props} />
          </Suspense>
        </div>
        <BlogSidebar />
      </Container>
    </>
  );
}
