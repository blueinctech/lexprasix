// Imports the WordPress export (migration/wp-export) into the database.
// Idempotent: every record is upserted by its WordPress ID (or a fixed key), so
// it can be rerun after a fresh export to pick up changes. Never touches the
// live WordPress site. Writes a machine-readable report to migration/logs/.
//
//   npm run migrate:content
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { parse, type HTMLElement } from "node-html-parser";
import { createDatabase } from "../src/db/client";
import * as s from "../src/db/schema";
import type { AnyBlock } from "../src/lib/blocks";
import { DEFAULT_SETTINGS } from "../src/lib/settings-schema";
import { plainText, readingMinutes, sanitizeRichHtml } from "../src/lib/sanitize";

config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
config({ quiet: true });

const EXPORT = "migration/wp-export";
const ORIGIN_RE = /https?:\/\/(?:www\.)?lexpraxisng\.com/gi;

type WP = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const load = async (name: string): Promise<WP[]> => JSON.parse(await readFile(`${EXPORT}/${name}.json`, "utf8"));
const [wpPosts, wpPages, wpMedia, wpCats, wpTags, wpUsers, wpComments] = await Promise.all(
  ["posts", "pages", "media", "categories", "tags", "users", "comments"].map(load),
);
const formIndex: { id: number; page: string; title: string }[] = JSON.parse(await readFile("migration/forms/index.json", "utf8"));

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, close } = await createDatabase(url, { max: 1 });

const report = {
  startedAt: new Date().toISOString(),
  source: {} as Record<string, number>,
  imported: {} as Record<string, number>,
  skipped: [] as { type: string; wpId: number | string; url: string; reason: string }[],
  review: [] as { type: string; wpId: number; url: string; reason: string }[],
  missingMedia: new Set<string>(),
};

// ---------------------------------------------------------------- helpers

const decode = (v: string) => plainText(v ?? "");
const pathOf = (link: string) => new URL(link).pathname;
const slugOf = (link: string) => pathOf(link).replace(/^\/|\/$/g, "");

const mediaByUrl = new Map<string, WP>(wpMedia.map((m) => [m.source_url.replace(/^http:/, "https:"), m]));

/** Rewrites absolute site links to relative ones and uploads to root-relative paths (resolved to the media host at render time). */
function rewriteLinks(html: string): string {
  return html
    .replace(/(src|href|srcset)="([^"]*)"/g, (_m, attr: string, value: string) => `${attr}="${value.replace(ORIGIN_RE, "")}"`)
    .replace(/https?:\/\/wordpress\.themeholy\.com\/ensaf[^"\s]*/g, "");
}

function collectUploads(html: string) {
  // Only this site's own uploads (links were made root-relative by rewriteLinks).
  for (const m of html.matchAll(/(?:src|href)="(\/wp-content\/uploads\/[^"?#]+)"/g)) {
    const full = `https://lexpraxisng.com${m[1]}`;
    const original = full.replace(/-\d+x\d+(\.\w+)$/, "$1");
    if (!mediaByUrl.has(full) && !mediaByUrl.has(original)) report.missingMedia.add(m[1]);
  }
}

function cleanPostHtml(raw: string): string {
  // WordPress figure/caption wrappers are kept by the sanitiser; class attributes are dropped.
  const html = sanitizeRichHtml(rewriteLinks(raw));
  collectUploads(html);
  return html;
}

function yoastSeo(item: WP): s.SeoFields {
  const y = item.yoast_head_json ?? {};
  const robots = y.robots ?? {};
  const canonical = typeof y.canonical === "string" ? y.canonical.replace(/^http:/, "https:") : "";
  const selfCanonical = canonical === item.link?.replace(/^http:/, "https:");
  return {
    title: y.title ? decode(y.title) : undefined,
    description: y.description ? decode(y.description) : undefined,
    // Only keep a canonical that points somewhere else; self-canonicals are generated.
    canonical: canonical && !selfCanonical ? canonical : undefined,
    noindex: robots.index === "noindex" || undefined,
    nofollow: robots.follow === "nofollow" || undefined,
    ogTitle: y.og_title && y.og_title !== y.title ? decode(y.og_title) : undefined,
    ogDescription: y.og_description && y.og_description !== y.description ? decode(y.og_description) : undefined,
    legacy: { title: y.title, description: y.description, canonical: y.canonical, robots, og_image: y.og_image?.[0]?.url, schema: (y.schema?.["@graph"] ?? []).map((g: WP) => g["@type"]) },
  };
}

async function upsertBy<T extends { wpId: unknown }>(
  table: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  rows: T[],
  target: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  update: (keyof T)[],
) {
  if (!rows.length) return [];
  const out: { id: string; wpId: number | null }[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const set = Object.fromEntries(update.map((k) => [k, sql.raw(`excluded."${toSnake(String(k))}"`)]));
    const res = await db.insert(table).values(chunk).onConflictDoUpdate({ target, set }).returning({ id: table.id, wpId: table.wpId });
    out.push(...(res as { id: string; wpId: number | null }[]));
  }
  return out;
}
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// ---------------------------------------------------------------- media rows (files are copied by migrate-media)

report.source.media = wpMedia.length;
const mediaRows = wpMedia.map((m) => {
  const src = m.source_url.replace(/^http:/, "https:");
  const key = decodeURIComponent(new URL(src).pathname.replace(/^\//, ""));
  return {
    key,
    filename: key.split("/").pop()!,
    mimeType: m.mime_type,
    size: m.media_details?.filesize ?? 0,
    width: m.media_details?.width ?? null,
    height: m.media_details?.height ?? null,
    alt: (m.alt_text ?? "").trim(),
    caption: decode(m.caption?.rendered ?? ""),
    description: "",
    wpId: m.id as number,
    legacyUrl: src,
  };
});
const media = await upsertBy(s.media, mediaRows, s.media.wpId, ["key", "filename", "mimeType", "size", "width", "height", "legacyUrl"]);
// Alt text and captions are editable in the admin: only fill them when empty.
for (const r of mediaRows.filter((r) => r.alt || r.caption)) {
  await db
    .update(s.media)
    .set({ alt: sql`case when ${s.media.alt} = '' then ${r.alt} else ${s.media.alt} end`, caption: sql`case when ${s.media.caption} = '' then ${r.caption} else ${s.media.caption} end` })
    .where(eq(s.media.wpId, r.wpId));
}
const mediaId = new Map(media.map((m) => [m.wpId!, m.id]));
report.imported.media = media.length;

// ---------------------------------------------------------------- authors

const postAuthors = new Set(wpPosts.map((p) => p.author));
report.source.authors = wpUsers.length;
const authorRows = wpUsers
  .filter((u) => postAuthors.has(u.id))
  .map((u) => ({ slug: u.slug, name: decode(u.name), bio: decode(u.description ?? ""), wpId: u.id as number, seo: {} }));
for (const u of wpUsers.filter((u) => !postAuthors.has(u.id))) report.skipped.push({ type: "author", wpId: u.id, url: u.link, reason: "No published posts (redirected to /blog/)" });
const authors = await upsertBy(s.authors, authorRows, s.authors.wpId, ["slug", "name"]);
const authorId = new Map(authors.map((a) => [a.wpId!, a.id]));
report.imported.authors = authors.length;

// ---------------------------------------------------------------- taxonomies

async function importTerms(kind: "categories" | "tags", rows: WP[]) {
  report.source[kind] = rows.length;
  const used = rows.filter((t) => t.count > 0);
  for (const t of rows.filter((t) => t.count === 0)) report.skipped.push({ type: kind, wpId: t.id, url: t.link, reason: "Empty term (already unlisted on the live site)" });
  const table = kind === "categories" ? s.categories : s.tags;
  const res = await upsertBy(
    table,
    used.map((t) => ({ slug: decodeURIComponent(t.slug), name: decode(t.name), description: decode(t.description ?? ""), wpId: t.id as number, seo: yoastSeo(t) })),
    table.wpId,
    ["slug", "name", "seo"],
  );
  report.imported[kind] = res.length;
  return new Map(res.map((r) => [r.wpId!, r.id]));
}
const categoryId = await importTerms("categories", wpCats);
const tagId = await importTerms("tags", wpTags);

// ---------------------------------------------------------------- posts

report.source.posts = wpPosts.length;
const postRows = wpPosts.map((p) => {
  const html = cleanPostHtml(p.content.rendered);
  if (/\[[a-z_][\w-]*[ \]]/i.test(plainText(html))) report.review.push({ type: "post", wpId: p.id, url: p.link, reason: "Contains a WordPress shortcode that does not render outside WordPress" });
  const excerpt = decode(p.excerpt?.rendered ?? "").replace(/\s*\[(…|&hellip;|\.\.\.)\]\s*$/, "…").slice(0, 400);
  return {
    slug: decodeURIComponent(p.slug),
    title: decode(p.title.rendered),
    excerpt,
    html,
    authorId: authorId.get(p.author) ?? null,
    featuredImageId: p.featured_media ? (mediaId.get(p.featured_media) ?? null) : null,
    status: "published" as const,
    publishedAt: new Date(`${p.date_gmt}Z`),
    contentUpdatedAt: new Date(`${p.modified_gmt}Z`),
    commentsOpen: false,
    readingMinutes: readingMinutes(html),
    seo: yoastSeo(p),
    wpId: p.id as number,
  };
});
const posts = await upsertBy(s.posts, postRows, s.posts.wpId, ["slug", "title", "excerpt", "html", "authorId", "featuredImageId", "publishedAt", "contentUpdatedAt", "readingMinutes", "seo"]);
const postId = new Map(posts.map((p) => [p.wpId!, p.id]));
report.imported.posts = posts.length;

// Taxonomy links are replaced wholesale for imported posts.
const ids = [...postId.values()];
await db.delete(s.postCategories).where(inArray(s.postCategories.postId, ids));
await db.delete(s.postTags).where(inArray(s.postTags.postId, ids));
const pc = wpPosts.flatMap((p) => p.categories.map((c: number) => ({ postId: postId.get(p.id)!, categoryId: categoryId.get(c)! }))).filter((r) => r.categoryId);
const pt = wpPosts.flatMap((p) => p.tags.map((t: number) => ({ postId: postId.get(p.id)!, tagId: tagId.get(t)! }))).filter((r) => r.tagId);
for (let i = 0; i < pc.length; i += 500) await db.insert(s.postCategories).values(pc.slice(i, i + 500)).onConflictDoNothing();
for (let i = 0; i < pt.length; i += 500) await db.insert(s.postTags).values(pt.slice(i, i + 500)).onConflictDoNothing();

// ---------------------------------------------------------------- comments (read-only archive)

report.source.comments = wpComments.length;
const commentRows = wpComments
  .filter((c) => postId.has(c.post))
  .map((c) => ({
    postId: postId.get(c.post)!,
    authorName: decode(c.author_name) || "Anonymous",
    html: sanitizeRichHtml(c.content.rendered.replace(/<a [^>]*>(.*?)<\/a>/g, "$1")),
    isStaffReply: c.author > 0,
    status: "approved" as const,
    wpId: c.id as number,
    createdAt: new Date(`${c.date_gmt}Z`),
  }));
const comments = await upsertBy(s.comments, commentRows, s.comments.wpId, ["html", "authorName"]);
const commentId = new Map(comments.map((c) => [c.wpId!, c.id]));
for (const c of wpComments.filter((c) => c.parent && commentId.has(c.parent))) {
  await db.update(s.comments).set({ parentId: commentId.get(c.parent)! }).where(eq(s.comments.wpId, c.id));
}
report.imported.comments = comments.length;

// ---------------------------------------------------------------- services

const SERVICE_ORDER = [
  "legal-service-subscription",
  "company-formation-and-restructuring",
  "access-to-foreign-markets",
  "tax-registration-filing-and-compliance",
  "intellectual-property-registration",
  "obtaining-business-licenses-and-permits",
  "contract-review-drafting-and-negotiation",
  "vc-and-equity-funding-advisory",
  "investor-due-diligence",
  "formation-of-non-profit-organizations-charities",
  "real-estate-transactions",
  "data-protection-and-compliance",
  "data-protection-officer-dpo-services-in-nigeria",
];
// Card labels used on the live homepage.
const SERVICE_SHORT: Record<string, string> = {
  "company-formation-and-restructuring": "Company Formation (Nigeria)",
  "access-to-foreign-markets": "Company Formation (International)",
  "intellectual-property-registration": "Intellectual Property Registration",
  "formation-of-non-profit-organizations-charities": "Non-Profits & Charities",
  "data-protection-officer-dpo-services-in-nigeria": "Data Protection Officer (DPO)",
};
const SERVICE_ICON: Record<string, string> = {
  "legal-service-subscription": "subscription",
  "company-formation-and-restructuring": "building",
  "access-to-foreign-markets": "globe",
  "tax-registration-filing-and-compliance": "receipt",
  "intellectual-property-registration": "badge",
  "obtaining-business-licenses-and-permits": "license",
  "contract-review-drafting-and-negotiation": "contract",
  "vc-and-equity-funding-advisory": "growth",
  "investor-due-diligence": "search",
  "formation-of-non-profit-organizations-charities": "hands",
  "real-estate-transactions": "home",
  "data-protection-and-compliance": "shield",
  "data-protection-officer-dpo-services-in-nigeria": "user-shield",
};

/** Content of an Elementor service page up to the repeated "All Services" sidebar. */
function serviceBody(html: string): string {
  const root = parse(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ""));
  const parts: string[] = [];
  const editors = root.querySelectorAll(".elementor-widget-text-editor, .elementor-widget-heading");
  for (const el of editors) {
    const text = el.text.replace(/\s+/g, " ").trim();
    if (/^All Services$/i.test(text) || /^Need Any Help\??$/i.test(text)) break;
    if (!text) continue;
    const container = (el.querySelector(".elementor-widget-container") ?? el) as HTMLElement;
    parts.push(container.innerHTML);
  }
  return sanitizeRichHtml(rewriteLinks(parts.join("\n")));
}

const servicePages = wpPages.filter((p) => pathOf(p.link).startsWith("/service/") && p.parent);
report.source.services = servicePages.length;
const serviceRows = servicePages.map((p) => {
  const slug = slugOf(p.link).replace(/^service\//, "");
  let body = serviceBody(p.content.rendered);
  const title = decode(p.title.rendered);
  // The page title is rendered as the H1, so drop a leading duplicate heading.
  body = body.replace(/^<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/, (m, inner) => (plainText(inner).toLowerCase() === title.toLowerCase() ? "" : m)).trim();
  const summary = plainText(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? "").slice(0, 300);
  if (plainText(body).length < 200) report.review.push({ type: "service", wpId: p.id, url: p.link, reason: "Short description on the live site; consider expanding (audience, process, FAQs)" });
  return {
    slug,
    title,
    shortTitle: SERVICE_SHORT[slug] ?? title,
    summary,
    body,
    icon: SERVICE_ICON[slug] ?? "",
    ctaLabel: "Book a free consultation",
    ctaHref: "/book-appointment/",
    sortOrder: SERVICE_ORDER.indexOf(slug) + 1 || 99,
    status: "published" as const,
    publishedAt: new Date(`${p.date_gmt}Z`),
    featuredImageId: p.featured_media ? (mediaId.get(p.featured_media) ?? null) : null,
    seo: yoastSeo(p),
    wpId: p.id as number,
  };
});
// Only overwrite editable copy on first import; later runs refresh SEO and order.
const services = await upsertBy(s.services, serviceRows, s.services.wpId, ["slug", "seo"]);
report.imported.services = services.length;

// ---------------------------------------------------------------- legal documents (form pages)

const CORPORATE = new Set([
  "incorporated-trustee", "us-company-registration", "company-seal", "company-registration", "copyright-registration",
  "application-for-tax-clearance-certificate", "trademark-registration", "company-stamp", "resolution-of-board-of-directors", "business-name-registration",
]);
// Labels from the live navigation menu.
const DOC_TITLE: Record<string, string> = {
  "application-for-tax-clearance-certificate": "Tax Clearance Certificate",
  "company-stamp": "Company Stamps",
  "non-disclosure-agreements": "Non-Disclosure Agreement",
  "incorporated-trustee": "Incorporated Trustees",
  "us-company-registration": "US Company Registration",
};
const NAV_ORDER = [
  "incorporated-trustee", "us-company-registration", "company-seal", "company-registration", "copyright-registration", "application-for-tax-clearance-certificate",
  "trademark-registration", "company-stamp", "resolution-of-board-of-directors", "business-name-registration", "employment-contract", "notice-of-rent-increase",
  "deed-of-assignment", "power-of-attorney", "loan-agreement", "partnership-agreement", "non-disclosure-agreements", "hire-purchase-agreement",
  "independent-contractors-agreement", "letter-of-confirmation", "tenancy-agreement", "trademark-assignment", "lease-agreement",
];
const docPages = wpPages.filter((p) => formIndex.some((f) => f.page === pathOf(p.link) && f.id !== 930));
report.source.documents = docPages.length;
const docRows = docPages.map((p) => {
  const slug = slugOf(p.link);
  const title = DOC_TITLE[slug] ?? decode(p.title.rendered);
  const group = CORPORATE.has(slug) ? "corporate-filings" : "agreements";
  const summary =
    group === "corporate-filings"
      ? `Start your ${title.toLowerCase()} online. Answer the questions below and our team will review your details and contact you about the next steps.`
      : `Request a ${title.toLowerCase()} prepared by our lawyers. Answer the questions below and we will review your details and contact you about the next steps.`;
  return {
    slug,
    title,
    group,
    summary,
    formId: slug,
    sortOrder: NAV_ORDER.indexOf(slug) + 1 || 99,
    status: "published" as const,
    publishedAt: new Date(`${p.date_gmt}Z`),
    seo: yoastSeo(p),
    wpId: p.id as number,
  };
});
const documents = await upsertBy(s.documents, docRows, s.documents.wpId, ["slug", "formId", "seo", "group", "sortOrder"]);
report.imported.documents = documents.length;

// ---------------------------------------------------------------- testimonials (published on the live homepage)

const TESTIMONIALS = [
  { name: "Oluebube Orji", quote: "I am extremely satisfied with the service provided by Lex-Praxis. From start to finish, their professionalism and efficiency exceeded my expectations. The entire process was handled swiftly, and I was impressed by how quickly they delivered results. I highly recommend Lex-Praxis to anyone seeking reliable and prompt business registration services." },
  { name: "Idris Lawal", quote: "Lex Praxis provided me a service far beyond my expectations. I am writing this due to how satisfied I am with the service. Right from the very first chat, through to the end of the transaction, it was all great experience. Despite some issues caused by the CAC, Lex was very prompt, professional, and forthcoming. I am really impressed and would 100% recommend to anyone seeking their services. Well done to Lex praxis!" },
  { name: "Uwakmfon Alfred", quote: "I cannot speak highly enough of Cynthia from Lex - Praxis. From the moment I engaged her services to register my organization, Flourish Her Africa, she demonstrated exceptional professionalism, reliability, and efficiency. I wholeheartedly recommend Cynthia and Lex - Praxis to anyone seeking legal services. Thank you, Cynthia, for your outstanding support and dedication!" },
  { name: "Ikakke Bassey", quote: "Lex-Praxis is a top notch legal firm that understands the needs of her clients and follows through with precision. My company have enjoyed such great professional relationship with the firm and its Principal. Thank you, Cynthia Tishion Esq." },
  { name: "Femi Fasae Jr.", quote: "Reached out to LEX PRAXIS BUSINESS LAWYERS on the 9th of August because I was being phased with the loss of my company’s INCORPORATION DOCUMENTS and it was more like a timeous affair and I was given a soundly built assurance by one of their associates that; everything they had to do was going to be done as and when due and truthfully, they even made it happen earlier than expected. I’m more than impressed." },
];
const existingTestimonials = await db.select({ name: s.testimonials.name }).from(s.testimonials);
const haveT = new Set(existingTestimonials.map((t) => t.name));
const newT = TESTIMONIALS.filter((t) => !haveT.has(t.name)).map((t) => ({ ...t, role: "Client", source: "website", sortOrder: TESTIMONIALS.indexOf(t) + 1, status: "published" as const }));
if (newT.length) await db.insert(s.testimonials).values(newT);
report.imported.testimonials = TESTIMONIALS.length;

// ---------------------------------------------------------------- pages

const pageById = new Map(wpPages.map((p) => [p.id, p]));
const richFrom = (id: number) => sanitizeRichHtml(rewriteLinks(pageById.get(id)?.content.rendered ?? ""));
let blockSeq = 0;
const bid = () => `b${++blockSeq}`;

function seoOf(id: number) {
  const p = pageById.get(id);
  return p ? yoastSeo(p) : {};
}

const PAGES: { wpId: number; path: string; title: string; template: string; summary?: string; blocks: AnyBlock[] }[] = [
  {
    wpId: 42,
    path: "",
    title: "LexPraxis Solicitors",
    template: "home",
    blocks: [
      {
        id: bid(), type: "hero", eyebrow: "Business law firm in Nigeria",
        heading: "Start, protect and grow your business with lawyers who understand it.",
        text: "We help local and foreign entrepreneurs and corporate organisations set up correctly in Nigeria, stay legally protected and compliant, and expand into new markets.",
        primary: { label: "Book a free consultation", href: "/book-appointment/" },
        secondary: { label: "Explore our services", href: "/service/" },
        imageId: null,
        points: ["Initial corporate setup", "Legal protection & compliance", "Access to foreign markets"],
      },
      // Figures from the live homepage, hidden until the firm confirms them (see docs/WEBSITE_AUDIT.md §6).
      { id: bid(), type: "stats", verified: false, items: [ { value: "250+", label: "Businesses" }, { value: "10+", label: "Countries" }, { value: "180+", label: "Happy clients" }, { value: "20+", label: "Partners" } ] },
      { id: bid(), type: "services", eyebrow: "What we do", heading: "Legal solutions for corporate success", text: "From incorporation to investor due diligence, we cover the legal work a growing business needs.", limit: 0 },
      {
        id: bid(), type: "steps", eyebrow: "How we work", heading: "Get started in three steps",
        items: [
          { title: "Book a discovery call", text: "Book a free discovery call to find out what you qualify for." },
          { title: "Get recommendations", text: "We recommend how we can help, based on your needs." },
          { title: "Achieve results", text: "We get to work on your matter and see it through to a satisfactory result." },
        ],
      },
      {
        id: bid(), type: "features", eyebrow: "Why LexPraxis", heading: "Legal-proof your business",
        text: "Running a business without an experienced legal team is like building a house without a solid foundation. When problems or opportunities arrive, the cost can be fines, reputational damage, disrupted operations or lost licences.",
        items: [
          { title: "Focus on what you love", text: "We handle the legal side so you can spend your time on the business itself." },
          { title: "Expand beyond borders", text: "Company formation and licensing in Nigeria, the US, the UK and Ghana." },
          { title: "Continuous legal support", text: "A legal service subscription gives you priority access to consultations, contract reviews and compliance guidance." },
          { title: "Offices in three cities", text: "Lagos, Abuja and Calabar, with clients served remotely across Nigeria and abroad." },
        ],
      },
      { id: bid(), type: "documents", eyebrow: "Legal documents online", heading: "Start a filing or agreement online", text: "Answer a guided questionnaire and our lawyers take it from there.", group: "all" },
      { id: bid(), type: "reviews", heading: "What our clients say", text: "" },
      { id: bid(), type: "latestPosts", eyebrow: "Insights", heading: "From our blog", count: 3 },
      { id: bid(), type: "cta", heading: "Book a free discovery call", text: "Tell us about your business. We'll explain your options and the next step.", primary: { label: "Book a call", href: "/book-appointment/" }, secondary: { label: "Contact us", href: "/contact-us/" } },
    ],
  },
  {
    wpId: 51,
    path: "about-us",
    title: "About Us",
    template: "default",
    summary: "LexPraxis is a business law firm in Nigeria for entrepreneurs and corporate organisations looking to start, grow and expand their businesses with legal protection.",
    blocks: [
      {
        id: bid(), type: "richText", heading: "Expert legal solutions for businesses",
        html: "<p>We help local and foreign entrepreneurs and businesses who are looking to start, grow or expand their businesses with:</p><ul><li><strong>Initial corporate setup</strong> – we help businesses across all sectors start on the right footing in Nigeria.</li><li><strong>Legal protection and compliance</strong> – beyond starting up, we make sure your business is legally protected in its dealings with investors, customers, regulators and partners.</li><li><strong>Access to foreign markets</strong> – we help businesses meet the legal requirements for entering the international markets where we operate.</li></ul>",
      },
      {
        id: bid(), type: "features", eyebrow: "So that you can", heading: "What we make possible",
        text: "",
        items: [
          { title: "Save time", text: "Focus on what you love in your business." },
          { title: "Expand with confidence", text: "Grow your business beyond borders." },
          { title: "Build with fulfilment", text: "Build the business of your dreams on a solid legal foundation." },
        ],
      },
      { id: bid(), type: "reviews", heading: "What our clients say", text: "" },
      { id: bid(), type: "cta", heading: "Let's talk about your business", text: "Book a free discovery call with our team.", primary: { label: "Book a call", href: "/book-appointment/" }, secondary: { label: "Our services", href: "/service/" } },
    ],
  },
  {
    wpId: 50, path: "contact-us", title: "Contact", template: "contact",
    summary: "Speak to a business lawyer at LexPraxis Solicitors. Offices in Lagos, Abuja and Calabar.",
    blocks: [
      { id: bid(), type: "contactForm", heading: "Send us a message", text: "Tell us briefly what you need. We usually reply within one business day." },
      { id: bid(), type: "offices", heading: "Our offices", showMap: true },
    ],
  },
  {
    wpId: 9077, path: "book-appointment", title: "Book Appointment", template: "booking",
    summary: "Book a free 30-minute discovery call with LexPraxis Solicitors.",
    blocks: [{ id: bid(), type: "calendly", heading: "Choose a time that suits you", text: "Pick a slot for a free 30-minute discovery call. You'll receive a calendar invitation and a reminder." }],
  },
  {
    wpId: 12651, path: "review", title: "Reviews", template: "reviews",
    summary: "What clients say about working with LexPraxis Solicitors.",
    blocks: [{ id: bid(), type: "reviews", heading: "Client reviews", text: "" }],
  },
  { wpId: 12532, path: "privacy-policy", title: "Privacy Policy", template: "legal", blocks: [{ id: bid(), type: "richText", heading: "", html: richFrom(12532) }] },
  { wpId: 12533, path: "terms-and-condition", title: "Terms and Conditions", template: "legal", blocks: [{ id: bid(), type: "richText", heading: "", html: richFrom(12533) }] },
  {
    wpId: 10099, path: "how-to-start-your-business-in-the-us-as-a-foreigner", title: "How to Start Your Business in the US as a Foreigner", template: "default",
    summary: "Recording of our 2022 session for African entrepreneurs registering a company in the United States.",
    blocks: [{ id: bid(), type: "richText", heading: "", html: richFrom(10099) }],
  },
  // Index routes: their title, intro and SEO are editable here; the listing is generated.
  { wpId: 3987, path: "blog", title: "Blog", template: "index", summary: "Practical guides on Nigerian business law, company registration, tax, intellectual property and compliance.", blocks: [] },
  { wpId: 53, path: "service", title: "Our Services", template: "index", summary: "Legal services for entrepreneurs, startups and corporate organisations in Nigeria and abroad.", blocks: [] },
  { wpId: 9083, path: "legal-forms", title: "Legal Documents", template: "index", summary: "Start a corporate filing or request a legal agreement online. Each questionnaire goes straight to our legal team.", blocks: [] },
  { wpId: 9079, path: "corporate-filings", title: "Corporate Filings", template: "index", summary: "Company, business name, trademark, copyright and tax filings handled by our lawyers.", blocks: [] },
];
report.source.pages = wpPages.length;
const pageRows = PAGES.map((p) => ({
  path: p.path,
  title: p.title,
  template: p.template,
  summary: p.summary ?? plainText(pageById.get(p.wpId)?.excerpt?.rendered ?? "").slice(0, 300),
  blocks: p.blocks as s.Block[],
  status: "published" as const,
  publishedAt: new Date(`${pageById.get(p.wpId)?.date_gmt ?? "2019-01-01T00:00:00"}Z`),
  seo: seoOf(p.wpId),
  wpId: p.wpId,
}));
// Page copy is editable in the admin: on reruns only refresh path and SEO.
const pages = await upsertBy(s.pages, pageRows, s.pages.wpId, ["path", "seo"]);
report.imported.pages = pages.length;

const handled = new Set([...PAGES.map((p) => p.wpId), ...servicePages.map((p) => p.id), ...docPages.map((p) => p.id)]);
const PAGE_SKIP_REASON: Record<string, string> = {
  "/home-full-width/": "2017 theme demo with raw shortcodes; 301 to /",
  "/practice-areas/": "2016 page with raw shortcodes; 301 to /service/",
  "/shop/": "WooCommerce: awaiting decision on the ebook shop",
  "/cart/": "WooCommerce: awaiting decision on the ebook shop",
  "/checkout/": "WooCommerce: awaiting decision on the ebook shop",
  "/my-account-2/": "WooCommerce: awaiting decision on the ebook shop",
};
for (const p of wpPages.filter((p) => !handled.has(p.id))) {
  report.skipped.push({ type: "page", wpId: p.id, url: p.link, reason: PAGE_SKIP_REASON[pathOf(p.link)] ?? "Not mapped — review" });
}

// ---------------------------------------------------------------- legacy ids, redirects

const legacy = [
  ...wpPosts.map((p) => ({ wpId: p.id, wpType: "post", path: pathOf(p.link) })),
  ...wpPages.filter((p) => handled.has(p.id)).map((p) => ({ wpId: p.id, wpType: "page", path: pathOf(p.link) })),
  ...wpPages.filter((p) => !handled.has(p.id)).map((p) => ({ wpId: p.id, wpType: "page", path: pathOf(p.link) === "/home-full-width/" ? "/" : pathOf(p.link) === "/practice-areas/" ? "/service/" : "/" })),
];
for (let i = 0; i < legacy.length; i += 200) {
  await db.insert(s.legacyIds).values(legacy.slice(i, i + 200)).onConflictDoUpdate({ target: s.legacyIds.wpId, set: { path: sql`excluded.path`, wpType: sql`excluded.wp_type` } });
}
report.imported.legacyIds = legacy.length;

const REDIRECTS = [
  { source: "/home-full-width/", destination: "/", note: "Legacy theme demo page" },
  { source: "/practice-areas/", destination: "/service/", note: "Legacy practice areas page" },
  { source: "/author/blueinchost/", destination: "/blog/", note: "Admin account with no posts" },
  // Linked from two posts; already a dead link on the WordPress site.
  { source: "/appointment-booking/", destination: "/book-appointment/", note: "Dead link in old posts" },
];
await db.insert(s.redirects).values(REDIRECTS).onConflictDoNothing();

// ---------------------------------------------------------------- menus (from the live header/footer)

const docMenu = (group: string) =>
  docRows
    .filter((d) => d.group === group)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({ id: `doc-${d.slug}`, label: d.title, href: `/${d.slug}/` }));
const svcMenu = serviceRows.sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({ id: `svc-${r.slug}`, label: r.shortTitle, href: `/service/${r.slug}/` }));
const MENUS: { key: string; label: string; items: s.MenuItem[] }[] = [
  {
    key: "header",
    label: "Header",
    items: [
      { id: "services", label: "Services", href: "/service/", children: svcMenu },
      {
        id: "documents",
        label: "Legal Documents",
        href: "/legal-forms/",
        children: [
          { id: "corporate", label: "Corporate filings", href: "/corporate-filings/", children: docMenu("corporate-filings") },
          { id: "agreements", label: "Agreements", href: "/legal-forms/", children: docMenu("agreements") },
        ],
      },
      { id: "about", label: "About", href: "/about-us/" },
      { id: "blog", label: "Blog", href: "/blog/" },
      { id: "contact", label: "Contact", href: "/contact-us/" },
    ],
  },
  { key: "footer-services", label: "Footer: services", items: svcMenu.slice(0, 7) },
  {
    key: "footer-company",
    label: "Footer: firm",
    items: [
      { id: "f-about", label: "About us", href: "/about-us/" },
      { id: "f-services", label: "All services", href: "/service/" },
      { id: "f-docs", label: "Legal documents", href: "/legal-forms/" },
      { id: "f-blog", label: "Blog", href: "/blog/" },
      { id: "f-reviews", label: "Reviews", href: "/review/" },
      { id: "f-book", label: "Book appointment", href: "/book-appointment/" },
      { id: "f-contact", label: "Contact", href: "/contact-us/" },
    ],
  },
  {
    key: "footer-legal",
    label: "Footer: legal",
    items: [
      { id: "l-privacy", label: "Privacy policy", href: "/privacy-policy/" },
      { id: "l-terms", label: "Terms and conditions", href: "/terms-and-condition/" },
    ],
  },
];
// Menus are editable: only create them if missing.
await db.insert(s.menus).values(MENUS).onConflictDoNothing();

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
}

// ---------------------------------------------------------------- report

// Records that disappeared from WordPress since a previous import are flagged, not deleted.
const goneposts = await db.select({ slug: s.posts.slug }).from(s.posts).where(and(notInArray(s.posts.wpId, wpPosts.map((p) => p.id)), sql`${s.posts.wpId} is not null`));
for (const g of goneposts) report.review.push({ type: "post", wpId: 0, url: `/${g.slug}/`, reason: "No longer in the WordPress export; kept here — review" });

await mkdir("migration/logs", { recursive: true });
const out = { ...report, missingMedia: [...report.missingMedia].sort(), finishedAt: new Date().toISOString() };
await writeFile("migration/logs/import-report.json", JSON.stringify(out, null, 2));
console.table(Object.keys({ ...report.source, ...report.imported }).map((k) => ({ type: k, source: report.source[k] ?? "", imported: report.imported[k] ?? "" })));
console.log(`Skipped: ${report.skipped.length}, needs review: ${report.review.length}, missing media: ${out.missingMedia.length}`);
await close();
