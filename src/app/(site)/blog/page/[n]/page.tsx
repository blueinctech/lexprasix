import { notFound } from "next/navigation";
import { Archive, archiveMetadata, parsePage } from "@/components/content/Archive";
import { listPosts } from "@/lib/content/queries";

type Props = { params: Promise<{ n: string }> };

export async function generateStaticParams() {
  const { pages } = await listPosts(1);
  return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({ params }: Props) {
  const page = parsePage((await params).n);
  return page ? archiveMetadata("blog", undefined, page) : {};
}

export default async function BlogPaged({ params }: Props) {
  const page = parsePage((await params).n);
  if (!page) notFound();
  return <Archive kind="blog" page={page} />;
}
