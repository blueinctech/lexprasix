// Writes the small route files for the blog and taxonomy/author archives
// (they differ only by kind). Run once after changing the template:
//   node scripts/gen-archive-routes.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = "src/app/(site)";
const w = async (file, body) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
};

await w(
  `${root}/blog/page.tsx`,
  `import { Archive, archiveMetadata } from "@/components/content/Archive";

export const generateMetadata = () => archiveMetadata("blog", undefined, 1);

export default function BlogPage() {
  return <Archive kind="blog" page={1} />;
}
`,
);

await w(
  `${root}/blog/page/[n]/page.tsx`,
  `import { notFound } from "next/navigation";
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
`,
);

for (const kind of ["category", "tag", "author"]) {
  const Name = kind[0].toUpperCase() + kind.slice(1);
  await w(
    `${root}/${kind}/[slug]/page.tsx`,
    `import { Archive, archiveMetadata } from "@/components/content/Archive";
import { archiveParams } from "@/lib/content/queries";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await archiveParams("${kind}")).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  return archiveMetadata("${kind}", decodeURIComponent((await params).slug), 1);
}

export default async function ${Name}Archive({ params }: Props) {
  return <Archive kind="${kind}" slug={decodeURIComponent((await params).slug)} page={1} />;
}
`,
  );
  await w(
    `${root}/${kind}/[slug]/page/[n]/page.tsx`,
    `import { notFound } from "next/navigation";
import { Archive, archiveMetadata, parsePage } from "@/components/content/Archive";
import { archiveParams } from "@/lib/content/queries";

type Props = { params: Promise<{ slug: string; n: string }> };

export async function generateStaticParams() {
  const terms = await archiveParams("${kind}");
  const params = terms.flatMap(({ slug, pages }) => Array.from({ length: pages - 1 }, (_, i) => ({ slug, n: String(i + 2) })));
  // At least one entry so the route can be prerendered; unknown pages 404 at request time.
  return params.length ? params : [{ slug: terms[0]?.slug ?? "none", n: "2" }];
}

export async function generateMetadata({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePage(n);
  return page ? archiveMetadata("${kind}", decodeURIComponent(slug), page) : {};
}

export default async function ${Name}ArchivePaged({ params }: Props) {
  const { slug, n } = await params;
  const page = parsePage(n);
  if (!page) notFound();
  return <Archive kind="${kind}" slug={decodeURIComponent(slug)} page={page} />;
}
`,
  );
}
console.log("Archive routes written.");
