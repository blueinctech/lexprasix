import { notFound } from "next/navigation";
import { Archive, archiveMetadata, parsePage } from "@/components/content/Archive";
import { archiveParams } from "@/lib/content/queries";


type Props = { params: Promise<{ slug: string; n: string }> };

export async function generateStaticParams() {
  const terms = await archiveParams("tag");
  const params = terms.flatMap(({ slug, pages }) => Array.from({ length: pages - 1 }, (_, i) => ({ slug, n: String(i + 2) })));
  // At least one entry so the route can be prerendered; unknown pages 404 at request time.
  return params.length ? params : [{ slug: terms[0]?.slug ?? "none", n: "2" }];
}

export async function generateMetadata({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePage(n);
  return page ? archiveMetadata("tag", decodeURIComponent(slug), page) : {};
}

export default async function TagArchivePaged({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePage(n);
  if (!page) notFound();
  return <Archive kind="tag" slug={decodeURIComponent(slug)} page={page} />;
}
