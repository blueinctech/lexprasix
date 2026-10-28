import { Archive, archiveMetadata } from "@/components/content/Archive";
import { archiveParams } from "@/lib/content/queries";


type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await archiveParams("tag")).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  return archiveMetadata("tag", decodeURIComponent((await params).slug), 1);
}

export default async function TagArchive({ params }: Props) {
  return <Archive kind="tag" slug={decodeURIComponent((await params).slug)} page={1} />;
}
