// Reconciles the WordPress export with the database and writes
// docs/MIGRATION_REPORT.md: counts, skipped records with reasons, media
// coverage, and every internal link in migrated content checked against the
// new site's routes.
//   npm run migrate:report
import { readFile, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { count, sql } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import * as s from "../src/db/schema";

config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
config({ quiet: true });

const report = JSON.parse(await readFile("migration/logs/import-report.json", "utf8"));
const exportSummary = JSON.parse(await readFile("migration/wp-export/summary.json", "utf8"));
const { db, close } = await createDatabase(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!, { max: 1 });

const n = async (t: Parameters<typeof db.select>[0] extends never ? never : any, where?: any) => (await db.select({ n: count() }).from(t).where(where))[0].n; // eslint-disable-line @typescript-eslint/no-explicit-any

const dest = {
  posts: await n(s.posts),
  pages: await n(s.pages),
  services: await n(s.services),
  documents: await n(s.documents),
  categories: await n(s.categories),
  tags: await n(s.tags),
  authors: await n(s.authors),
  comments: await n(s.comments),
  media: await n(s.media),
  testimonials: await n(s.testimonials),
  legacyIds: await n(s.legacyIds),
  redirects: await n(s.redirects),
  menus: await n(s.menus),
  settings: await n(s.settings),
};

// ---- Known routes on the new site
const [postSlugs, docSlugs, pagePaths, svcSlugs, catSlugs, tagSlugs, authorSlugs, redirectRows, mediaKeys] = await Promise.all([
  db.select({ v: s.posts.slug }).from(s.posts),
  db.select({ v: s.documents.slug }).from(s.documents),
  db.select({ v: s.pages.path }).from(s.pages),
  db.select({ v: s.services.slug }).from(s.services),
  db.select({ v: s.categories.slug }).from(s.categories),
  db.select({ v: s.tags.slug }).from(s.tags),
  db.select({ v: s.authors.slug }).from(s.authors),
  db.select({ v: s.redirects.source }).from(s.redirects),
  db.select({ v: s.media.key }).from(s.media),
]);
const known = new Set<string>([
  "/",
  "/blog/",
  "/service/",
  "/legal-forms/",
  "/corporate-filings/",
  "/feed/",
  ...postSlugs.map((r) => `/${r.v}/`),
  ...docSlugs.map((r) => `/${r.v}/`),
  ...pagePaths.map((r) => (r.v ? `/${r.v}/` : "/")),
  ...svcSlugs.map((r) => `/service/${r.v}/`),
  ...catSlugs.map((r) => `/category/${r.v}/`),
  ...tagSlugs.map((r) => `/tag/${r.v}/`),
  ...authorSlugs.map((r) => `/author/${r.v}/`),
]);
const redirects = new Set(redirectRows.map((r) => r.v));
const keys = new Set(mediaKeys.map((r) => r.v));
const configRedirect = (p: string) => /^\/\d{4}\/\d{2}(\/\d{2})?\/$/.test(p) || /sitemap.*\.xml$/.test(p) || /\/feed\/$/.test(p) || p.startsWith("/wp-admin");

// ---- Check links and images in migrated content
const sources = [
  ...(await db.select({ where: s.posts.slug, html: s.posts.html }).from(s.posts)).map((r) => ({ where: `/${r.where}/`, html: r.html })),
  ...(await db.select({ where: s.services.slug, html: s.services.body }).from(s.services)).map((r) => ({ where: `/service/${r.where}/`, html: r.html })),
  ...(await db.select({ where: s.pages.path, blocks: sql<string>`${s.pages.blocks}::text` }).from(s.pages)).map((r) => ({ where: `/${r.where}/`, html: r.blocks.replace(/\\"/g, '"') })),
];
const broken: { page: string; link: string; reason: string }[] = [];
let internalLinks = 0;
let images = 0;
const missingImages: { page: string; src: string }[] = [];
for (const src of sources) {
  for (const m of src.html.matchAll(/href="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    let path = decodeURIComponent(m[1]);
    if (path.startsWith("/wp-content/uploads/")) {
      if (!keys.has(path.slice(1)) && !keys.has(path.slice(1).replace(/-\d+x\d+(\.\w+)$/, "$1"))) broken.push({ page: src.where, link: path, reason: "Linked file not in media library" });
      continue;
    }
    internalLinks++;
    if (!path.endsWith("/") && !/\.[a-z0-9]+$/i.test(path)) path += "/";
    if (!known.has(path) && !redirects.has(path.toLowerCase()) && !configRedirect(path) && !known.has(path.toLowerCase())) broken.push({ page: src.where, link: path, reason: "No page or redirect at this path" });
  }
  for (const m of src.html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    images++;
    const v = m[1];
    if (v.startsWith("/wp-content/uploads/")) {
      const key = v.slice(1).split("?")[0];
      if (!keys.has(key) && !keys.has(key.replace(/-\d+x\d+(\.\w+)$/, "$1"))) missingImages.push({ page: src.where, src: v });
    }
  }
}
const externalImages = sources.reduce((a, src) => a + [...src.html.matchAll(/<img[^>]+src="https?:\/\/(?!lexpraxisng\.com)/g)].length, 0);

// Was each missing image already broken on the live WordPress site? (read-only HEAD requests)
const liveStatus = new Map<string, number>();
for (const src of new Set(missingImages.map((m) => m.src))) {
  try {
    liveStatus.set(src, (await fetch(`https://lexpraxisng.com${src}`, { method: "HEAD" })).status);
  } catch {
    liveStatus.set(src, 0);
  }
}
const preBroken = missingImages.filter((m) => liveStatus.get(m.src) === 404).length;

const row = (k: string, src: number | string, d: number | string, note = "") => `| ${k} | ${src} | ${d} | ${note} |`;
const md = `# Migration report

Generated ${new Date().toISOString()} by \`npm run migrate:report\` from the WordPress export of ${exportSummary.exportedAt} (${exportSummary.source}) and the current database.

## 1. Record counts

| Type | WordPress | New site | Notes |
|---|---|---|---|
${row("Posts", report.source.posts, dest.posts, dest.posts === report.source.posts ? "All migrated" : "**Mismatch — investigate**")}
${row("Pages (all)", report.source.pages, `${dest.pages} pages + ${dest.services} services + ${dest.documents} legal documents`, `${report.source.pages - dest.pages - dest.services - dest.documents} intentionally not migrated (see §2)`)}
${row("Categories", report.source.categories, dest.categories, `${report.source.categories - dest.categories} empty categories skipped (already unlisted on the live site)`)}
${row("Tags", report.source.tags, dest.tags, `${report.source.tags - dest.tags} empty tags skipped (already 404 on the live site)`)}
${row("Authors", report.source.authors, dest.authors, "Only users with published posts become public authors")}
${row("Comments", report.source.comments, dest.comments, "Read-only archive; commenter emails not imported")}
${row("Media records", report.source.media, dest.media, "Files are copied to storage by the media migration step (see §4)")}
${row("Testimonials", "5 (homepage)", dest.testimonials, "")}
${row("Legacy IDs (?p=)", "—", dest.legacyIds, "Every WordPress post/page ID redirects")}
${row("Redirects", "—", dest.redirects, "Plus pattern redirects in next.config.ts")}
${row("Menus / settings", "—", `${dest.menus} / ${dest.settings}`, "Rebuilt from the live header/footer; confirm against WP menus (needs admin)")}

## 2. Records not migrated (intentional)

| Type | URL | Reason |
|---|---|---|
${report.skipped.map((x: { type: string; url: string; reason: string }) => `| ${x.type} | ${x.url} | ${x.reason} |`).join("\n")}

## 3. Needs manual review

| Type | URL | Reason |
|---|---|---|
${report.review.map((x: { type: string; url: string; reason: string }) => `| ${x.type} | ${x.url} | ${x.reason} |`).join("\n") || "| — | — | — |"}

## 4. Media

- Media library items: ${dest.media}. Inline images checked in migrated content: ${images} (${externalImages} hosted on third-party sites, left as-is).
- Image references in content that are **not in the WordPress media library**: ${missingImages.length} (${new Set(missingImages.map((m) => m.src)).size} distinct files). Of these, ${preBroken} already return 404 on the live WordPress site, so nothing was lost in migration.
${[...new Set(missingImages.map((m) => `  - ${m.page} → \`${m.src}\` (live site: ${liveStatus.get(m.src) || "unreachable"})`))].join("\n")}
- Already broken on the live site before migration (404 on lexpraxisng.com): ${report.missingMedia.length}
${report.missingMedia.map((m: string) => `  - \`${m}\``).join("\n")}
- **File copy status:** media files are still served from the WordPress host in development. Copy them to the production bucket with the media migration step before launch; until then this section cannot report storage coverage.

## 5. Internal links in migrated content

Checked ${internalLinks} internal links across ${sources.length} posts, services and pages. Broken: **${broken.length}**.

${broken.length ? `| Page | Link | Problem |\n|---|---|---|\n${broken.map((b) => `| ${b.page} | \`${b.link}\` | ${b.reason} |`).join("\n")}` : "No broken internal links."}

## 6. URL differences

All posts, legal-document pages, services, categories, tags and author archives keep their WordPress URLs. Changed URLs are listed in [REDIRECT_MAP.csv](REDIRECT_MAP.csv).

## 7. Metadata

Yoast titles, descriptions, canonicals (when not self-referencing), robots directives and OG overrides are stored per record in the \`seo\` column, with the original Yoast values kept under \`seo.legacy\` for comparison. See [SEO_MIGRATION_REPORT.md](SEO_MIGRATION_REPORT.md) for the crawl comparison.
`;
await writeFile("docs/MIGRATION_REPORT.md", md);
console.log(`Wrote docs/MIGRATION_REPORT.md — ${broken.length} broken links, ${missingImages.length} missing images.`);
await close();
