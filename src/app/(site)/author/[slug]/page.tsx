import { Archive, archiveMetadata } from "@/components/content/Archive";
import { archiveParams } from "@/lib/content/queries";


type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await archiveParams("author")).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  return archiveMetadata("author", decodeURIComponent((await params).slug), 1);
}

export default async function AuthorArchive({ params }: Props) {
  return <Archive kind="author" slug={decodeURIComponent((await params).slug)} page={1} />;
}
