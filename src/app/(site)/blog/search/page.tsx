import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBox } from "@/components/content/Archive";
import { PageHeader, PostGrid } from "@/components/content/common";
import { Container } from "@/components/ui/primitives";
import { listPosts } from "@/lib/content/queries";

// Search results are per-request and not indexed.
export const metadata: Metadata = { title: { absolute: "Search articles - Lexpraxis Solicitors" }, robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string }> };

async function Results({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  if (!q) return <p className="text-ink-muted">Type a few words to search the blog.</p>;
  const { items, total } = await listPosts(1, { q });
  return (
    <>
      <p className="mb-10 text-ink-muted">
        {total} result{total === 1 ? "" : "s"} for “{q}”{total > items.length ? ` (showing the ${items.length} most recent)` : ""}
      </p>
      {items.length ? <PostGrid posts={items} /> : <p className="text-ink-muted">No articles matched. Try different words or browse the blog.</p>}
    </>
  );
}

export default function SearchPage(props: Props) {
  return (
    <>
      <PageHeader crumbs={[{ name: "Home", path: "/" }, { name: "Blog", path: "/blog/" }, { name: "Search", path: "/blog/search/" }]} title="Search articles">
        <SearchBox />
      </PageHeader>
      <Container className="py-16">
        <Suspense fallback={<p className="text-ink-muted">Searching…</p>}>
          <Results {...props} />
        </Suspense>
      </Container>
    </>
  );
}
