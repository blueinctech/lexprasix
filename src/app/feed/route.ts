import { getSettings, latestPosts } from "@/lib/content/queries";
import { escapeHtml } from "@/lib/email/templates";
import { absoluteUrl } from "@/lib/seo";

// RSS 2.0 feed at /feed/ (the WordPress feed URL), latest 20 articles.
export async function GET() {
  const [settings, posts] = await Promise.all([getSettings(), latestPosts(20)]);
  const items = posts
    .map(
      (p) => `<item><title>${escapeHtml(p.title)}</title><link>${absoluteUrl(`/${p.slug}/`)}</link><guid isPermaLink="true">${absoluteUrl(`/${p.slug}/`)}</guid><pubDate>${p.publishedAt.toUTCString()}</pubDate>${p.author ? `<dc:creator>${escapeHtml(p.author.name)}</dc:creator>` : ""}${p.category ? `<category>${escapeHtml(p.category.name)}</category>` : ""}<description>${escapeHtml(p.excerpt)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${escapeHtml(settings.site.name)}</title><link>${absoluteUrl("/")}</link><atom:link href="${absoluteUrl("/feed/")}" rel="self" type="application/rss+xml"/><description>${escapeHtml(settings.site.tagline)}</description><language>en-NG</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" } });
}
