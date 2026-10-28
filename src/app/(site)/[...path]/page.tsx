import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { after } from "next/server";
import { recordRedirectHit } from "@/lib/redirect-hits";
import { DocumentView, PageView, PostView } from "@/components/content/views";
import { getDocument, getPageByPath, getPost, getRedirect, getSettings, resolveRootSlug, rootSlugs } from "@/lib/content/queries";
import { buildMetadata } from "@/lib/seo";

// Everything not matched by a more specific route. Root-level URLs are shared,
// as on WordPress, by blog posts, legal-document pages and CMS pages. Any other
// path is checked against the redirects managed in the admin, then 404s.

type Props = { params: Promise<{ path: string[] }> };

function slugFrom(path: string[]): string | null {
  return path.length === 1 ? decodeURIComponent(path[0]) : null;
}

export async function generateStaticParams() {
  return (await rootSlugs()).map((slug) => ({ path: [slug] }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = slugFrom((await params).path);
  if (!slug) return {};
  const [settings, kind] = await Promise.all([getSettings(), resolveRootSlug(slug)]);
  const path = `/${slug}/`;
  if (kind === "post") {
    const p = (await getPost(slug))!;
    return buildMetadata({ settings, path, title: p.title, description: p.excerpt, seo: p.seo, image: p.ogImage ?? p.featuredImage, type: "article", publishedTime: p.publishedAt, modifiedTime: p.contentUpdatedAt, authors: p.author ? [p.author.name] : [] });
  }
  if (kind === "document") {
    const d = (await getDocument(slug))!;
    return buildMetadata({ settings, path, title: d.title, description: d.summary, seo: d.seo, image: d.ogImage });
  }
  if (kind === "page") {
    const p = (await getPageByPath(slug))!;
    return buildMetadata({ settings, path, title: p.title, description: p.summary, seo: p.seo, image: p.ogImage ?? p.featuredImage });
  }
  return {};
}

export default async function CatchAllPage({ params }: Props) {
  const segments = (await params).path;
  const slug = slugFrom(segments);
  if (slug) {
    const kind = await resolveRootSlug(slug);
    if (kind === "post") return <PostView post={(await getPost(slug))!} />;
    if (kind === "document") return <DocumentView doc={(await getDocument(slug))!} />;
    if (kind === "page") return <PageView page={(await getPageByPath(slug))!} />;
  }
  const path = `/${segments.map(decodeURIComponent).join("/")}/`.toLowerCase();
  const target = await getRedirect(path);
  if (target) {
    after(() => recordRedirectHit(path));
    if (target.statusCode === 302 || target.statusCode === 307) redirect(target.destination);
    permanentRedirect(target.destination);
  }
  notFound();
}
