import type { Metadata } from "next";
import type { SeoFields } from "@/db/schema";
import { isProductionSite, siteUrl } from "@/lib/env";
import type { Settings } from "@/lib/settings-schema";
import type { ImageInfo } from "./content/queries";

// Metadata and JSON-LD built the same way Yoast did on the WordPress site, so
// titles, canonicals and the schema graph carry over. Record-level SEO fields
// win; otherwise "{Title}{titleSuffix}" and the record's summary are used.

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildMetadata(opts: {
  settings: Settings;
  path: string;
  title: string;
  description?: string;
  seo?: SeoFields;
  image?: ImageInfo | null;
  type?: "website" | "article" | "profile";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  authors?: string[];
  /** A full title that should not get the site suffix (e.g. Yoast author archives). */
  absoluteTitle?: string;
  /** Paginated or filtered listing pages beyond the first. */
  noindex?: boolean;
}): Metadata {
  const { settings, seo = {} } = opts;
  // The suffix carries its own " - " separator; add the space if an editor saved it without one.
  const suffix = settings.seo.titleSuffix && !/^\s/.test(settings.seo.titleSuffix) ? ` ${settings.seo.titleSuffix}` : settings.seo.titleSuffix;
  const title = seo.title || (opts.absoluteTitle ?? `${opts.title}${suffix}`);
  const description = seo.description || opts.description || settings.seo.defaultDescription;
  const canonical = seo.canonical || absoluteUrl(opts.path);
  const image = opts.image?.url ?? (settings.seo.defaultOgImageUrl || undefined);
  const noindex = Boolean(seo.noindex || opts.noindex);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    // Non-production deployments are noindex from the root layout.
    ...(isProductionSite ? { robots: { index: !noindex, follow: !seo.nofollow } } : {}),
    openGraph: {
      type: opts.type ?? "website",
      locale: "en_US",
      siteName: settings.site.name,
      url: canonical,
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      ...(image ? { images: [{ url: image, ...(opts.image?.width ? { width: opts.image.width, height: opts.image.height ?? undefined } : {}), alt: opts.image?.alt || opts.title }] } : {}),
      ...(opts.type === "article" ? { publishedTime: opts.publishedTime?.toISOString(), modifiedTime: opts.modifiedTime?.toISOString(), authors: opts.authors } : {}),
    },
    twitter: { card: "summary_large_image" },
  };
}

// ---------------------------------------------------------------- JSON-LD

const ORG_ID = () => `${siteUrl()}/#organization`;
const SITE_ID = () => `${siteUrl()}/#website`;

export function organizationNode(settings: Settings) {
  const sameAs = Object.values(settings.site.social).filter(Boolean);
  return {
    "@type": "Organization",
    "@id": ORG_ID(),
    name: settings.site.name,
    url: `${siteUrl()}/`,
    logo: { "@type": "ImageObject", url: `${siteUrl()}/icon.png` },
    email: settings.site.email,
    ...(settings.site.phones[0] ? { telephone: settings.site.phones[0] } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteNode(settings: Settings) {
  return { "@type": "WebSite", "@id": SITE_ID(), url: `${siteUrl()}/`, name: settings.site.name, description: settings.site.tagline, publisher: { "@id": ORG_ID() }, inLanguage: "en-US" };
}

export type Crumb = { name: string; path: string };

export function breadcrumbNode(path: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(path)}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, ...(i < crumbs.length - 1 ? { item: absoluteUrl(c.path) } : {}) })),
  };
}

export function webPageNode(opts: { path: string; title: string; description?: string; type?: string | string[]; image?: ImageInfo | null; datePublished?: Date | null; dateModified?: Date | null; hasBreadcrumb?: boolean }) {
  const url = absoluteUrl(opts.path);
  return {
    "@type": opts.type ?? "WebPage",
    "@id": url,
    url,
    name: opts.title,
    ...(opts.description ? { description: opts.description } : {}),
    isPartOf: { "@id": SITE_ID() },
    ...(opts.image ? { primaryImageOfPage: { "@type": "ImageObject", url: opts.image.url } } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished.toISOString() } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified.toISOString() } : {}),
    ...(opts.hasBreadcrumb ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    inLanguage: "en-US",
  };
}

export function articleNode(opts: { path: string; title: string; description: string; image?: ImageInfo | null; datePublished: Date; dateModified: Date; author?: { name: string; slug: string } | null; keywords?: string[]; sections?: string[] }) {
  const url = absoluteUrl(opts.path);
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    isPartOf: { "@id": url },
    mainEntityOfPage: { "@id": url },
    headline: opts.title.slice(0, 110),
    description: opts.description,
    datePublished: opts.datePublished.toISOString(),
    dateModified: opts.dateModified.toISOString(),
    ...(opts.author ? { author: { "@type": "Person", name: opts.author.name, url: absoluteUrl(`/author/${opts.author.slug}/`) } } : {}),
    publisher: { "@id": ORG_ID() },
    ...(opts.image ? { image: { "@type": "ImageObject", url: opts.image.url, ...(opts.image.width ? { width: opts.image.width, height: opts.image.height } : {}) } } : {}),
    ...(opts.keywords?.length ? { keywords: opts.keywords } : {}),
    ...(opts.sections?.length ? { articleSection: opts.sections } : {}),
    inLanguage: "en-US",
  };
}

export function faqNode(path: string, items: { question: string; answer: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": `${absoluteUrl(path)}#faq`,
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
  };
}

export function graph(...nodes: (Record<string, unknown> | null | undefined | false)[]) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
