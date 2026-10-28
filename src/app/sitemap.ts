import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/content/queries";
import { absoluteUrl } from "@/lib/seo";

// Every published, indexable URL. Replaces Yoast's sitemap index (the old
// /sitemap_index.xml and sub-sitemaps redirect here).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const e = await sitemapEntries();
  return [
    ...e.pages.map((p) => ({ url: absoluteUrl(p.path ? `/${p.path}/` : "/"), lastModified: p.updatedAt, priority: p.path === "" ? 1 : 0.7 })),
    ...e.services.map((s) => ({ url: absoluteUrl(`/service/${s.slug}/`), lastModified: s.updatedAt, priority: 0.8 })),
    ...e.documents.map((d) => ({ url: absoluteUrl(`/${d.slug}/`), lastModified: d.updatedAt, priority: 0.7 })),
    ...e.posts.map((p) => ({ url: absoluteUrl(`/${p.slug}/`), lastModified: p.updatedAt ?? undefined, priority: 0.6 })),
    ...e.cats.map((c) => ({ url: absoluteUrl(`/category/${c.slug}/`), priority: 0.4 })),
    ...e.tags.map((t) => ({ url: absoluteUrl(`/tag/${t.slug}/`), priority: 0.3 })),
    ...e.authors.map((a) => ({ url: absoluteUrl(`/author/${a.slug}/`), priority: 0.3 })),
  ];
}
