import { Archive, archiveMetadata } from "@/components/content/Archive";

export const generateMetadata = () => archiveMetadata("blog", undefined, 1);

export default function BlogPage() {
  return <Archive kind="blog" page={1} />;
}
