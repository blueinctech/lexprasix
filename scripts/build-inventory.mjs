// Builds docs/PAGE_INVENTORY.csv from the WordPress export and the SEO baseline
// crawl, with the planned destination for every URL. Rerun after a fresh export.
//   node scripts/build-inventory.mjs
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "node-html-parser";

const EXPORT = "migration/wp-export";
const load = async (n) => JSON.parse(await readFile(`${EXPORT}/${n}.json`, "utf8"));
const [pages, posts, categories, tags, users, products] = await Promise.all(["pages", "posts", "categories", "tags", "users", "product"].map(load));
const forms = JSON.parse(await readFile("migration/forms/index.json", "utf8"));

// Baseline crawl -> map by URL
const csvText = await readFile("migration/baseline/seo-baseline.csv", "utf8");
function parseCsv(t) {
  const rows = [];
  let r = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { r.push(f); f = ""; }
    else if (c === "\n") { r.push(f); rows.push(r); r = []; f = ""; }
    else f += c;
  }
  r.push(f); rows.push(r);
  const head = rows.shift();
  return rows.map((x) => Object.fromEntries(head.map((k, i) => [k, x[i]])));
}
const crawl = new Map(parseCsv(csvText).map((r) => [new URL(r.url).pathname + new URL(r.url).search, r]));

const ORIGIN = "https://lexpraxisng.com";
const pathOf = (u) => new URL(u).pathname;
const formByPage = new Map(forms.map((f) => [f.page, f]));
const textLen = (html) => parse(html).text.replace(/\s+/g, " ").trim().length;

// Decisions for pages that do not map 1:1 onto a standard template.
const PAGE_DECISIONS = {
  "/": ["home", "keep", "/", "Rebuilt homepage; trust figures need firm confirmation"],
  "/blog/": ["blog-index", "keep", "/blog/", "Paginated archive at /blog/page/N/"],
  "/service/": ["service-index", "keep", "/service/", "Lists services from the CMS"],
  "/legal-forms/": ["document-index", "keep", "/legal-forms/", "Lists legal document intake pages"],
  "/corporate-filings/": ["document-index", "keep", "/corporate-filings/", "Empty in WordPress (menu parent); becomes a listing of filing services"],
  "/contact-us/": ["contact", "keep", "/contact-us/", "Contact form (CF7 930) + offices + map"],
  "/book-appointment/": ["booking", "keep", "/book-appointment/", "Calendly lexpraxisng-info/30min embed"],
  "/review/": ["reviews", "keep", "/review/", "Trustindex Google-reviews widget; keep embed or import verified reviews"],
  "/about-us/": ["about", "keep", "/about-us/", ""],
  "/privacy-policy/": ["legal", "keep", "/privacy-policy/", "Needs update for new processors (hosting, email, storage)"],
  "/terms-and-condition/": ["legal", "keep", "/terms-and-condition/", ""],
  "/shop/": ["shop", "decision-needed", "/shop/", "WooCommerce: 1 ebook product; payment gateway unknown until admin access"],
  "/cart/": ["woocommerce", "decision-needed", "/shop/", "Redirect if ebook checkout moves to a hosted checkout"],
  "/checkout/": ["woocommerce", "decision-needed", "/shop/", "Currently 302s to /cart/"],
  "/my-account-2/": ["woocommerce", "decision-needed", "/shop/", "Customer accounts; depends on ebook decision"],
  "/home-full-width/": ["legacy", "redirect", "/", "2017 WPBakery theme demo page still published; old shortcodes render as text"],
  "/practice-areas/": ["legacy", "redirect", "/service/", "2016 WPBakery page; shortcodes render as text"],
  "/how-to-start-your-business-in-the-us-as-a-foreigner/": ["landing", "keep", "/how-to-start-your-business-in-the-us-as-a-foreigner/", "2022 webinar landing page; confirm whether still wanted"],
};

const rows = [];
const add = (r) => rows.push(r);

for (const p of pages) {
  const path = pathOf(p.link);
  const form = formByPage.get(path);
  const c = crawl.get(path) ?? {};
  let [type, action, dest, notes] = PAGE_DECISIONS[path] ?? [];
  if (!type) {
    if (path.startsWith("/service/")) [type, action, dest, notes] = ["service", "keep", path, "Service detail template"];
    else if (form) [type, action, dest, notes] = ["legal-document-intake", "keep", path, `Gravity Form ${form.id} (${form.fields} fields, ${form.uploads} uploads)`];
    else [type, action, dest, notes] = ["page", "keep", path, ""];
  }
  add({
    url: ORIGIN + path, wp_type: "page", wp_id: p.id, page_type: type, title: p.title.rendered, status: p.status, modified: p.modified,
    content_chars: textLen(p.content.rendered), form: form ? `${form.engine}:${form.id}` : "", seo_title: c.title ?? "", meta_description: c.description ?? "",
    h1: c.h1 ?? "", canonical: c.canonical ?? "", http_status: c.status ?? "", action, destination: ORIGIN + dest, notes,
  });
}
const catName = new Map(categories.map((c) => [c.id, c.name]));
const author = new Map(users.map((u) => [u.id, u.name]));
for (const p of posts) {
  const path = pathOf(p.link);
  const c = crawl.get(path) ?? {};
  add({
    url: ORIGIN + path, wp_type: "post", wp_id: p.id, page_type: "blog-post", title: p.title.rendered, status: p.status, modified: p.modified,
    content_chars: textLen(p.content.rendered), form: "", seo_title: c.title ?? "", meta_description: c.description ?? "", h1: c.h1 ?? "",
    canonical: c.canonical ?? "", http_status: c.status ?? "", action: "keep", destination: ORIGIN + path,
    notes: `Author: ${author.get(p.author) ?? p.author}; categories: ${p.categories.map((id) => catName.get(id)).join("; ")}`,
  });
}
for (const t of [...categories.map((x) => ["category", x]), ...tags.map((x) => ["tag", x])]) {
  const [kind, x] = t;
  const path = pathOf(x.link);
  const c = crawl.get(path) ?? {};
  add({
    url: ORIGIN + path, wp_type: kind, wp_id: x.id, page_type: `${kind}-archive`, title: x.name, status: x.count ? "has-posts" : "empty", modified: "",
    content_chars: "", form: "", seo_title: c.title ?? "", meta_description: c.description ?? "", h1: c.h1 ?? "", canonical: c.canonical ?? "",
    http_status: c.status ?? (x.count ? "" : "404 (empty)"), action: x.count ? "keep" : "omit (empty, already 404/unlisted)", destination: x.count ? ORIGIN + path : "",
    notes: `${x.count} posts`,
  });
}
for (const u of users) {
  const path = pathOf(u.link);
  const has = posts.some((p) => p.author === u.id);
  add({
    url: ORIGIN + path, wp_type: "author", wp_id: u.id, page_type: "author-archive", title: u.name, status: has ? "has-posts" : "no-posts", modified: "",
    content_chars: "", form: "", seo_title: crawl.get(path)?.title ?? "", meta_description: "", h1: "", canonical: "", http_status: crawl.get(path)?.status ?? "",
    action: has ? "keep" : "redirect", destination: has ? ORIGIN + path : ORIGIN + "/blog/", notes: has ? "" : "Admin account with no posts",
  });
}
for (const p of products) {
  const path = pathOf(p.link);
  add({
    url: ORIGIN + path, wp_type: "product", wp_id: p.id, page_type: "product", title: p.title.rendered, status: p.status, modified: p.modified,
    content_chars: textLen(p.content.rendered), form: "", seo_title: crawl.get(path)?.title ?? "", meta_description: crawl.get(path)?.description ?? "",
    h1: crawl.get(path)?.h1 ?? "", canonical: "", http_status: crawl.get(path)?.status ?? "", action: "decision-needed", destination: ORIGIN + path,
    notes: "Ebook sold via WooCommerce; store API reports USD 3,000.00 (likely misconfigured currency) — confirm price and gateway",
  });
}
for (const [path] of crawl) {
  if (path.startsWith("/?ensaf_")) {
    add({
      url: ORIGIN + path, wp_type: "theme-artefact", wp_id: "", page_type: "theme-artefact", title: "Ensaf header/footer builder post", status: "publish", modified: "",
      content_chars: "", form: "", seo_title: crawl.get(path).title, meta_description: "", h1: "", canonical: crawl.get(path).canonical, http_status: crawl.get(path).status,
      action: "redirect", destination: ORIGIN + "/", notes: "Theme template exposed in Yoast sitemap; should never have been indexable",
    });
  }
}

// Anything else in the sitemap that the sections above did not cover.
const seen = new Set(rows.map((r) => r.url));
for (const [path, c] of crawl) {
  if (seen.has(ORIGIN + path)) continue;
  const woo = /^\/product-(category|tag)\//.test(path);
  add({
    url: ORIGIN + path, wp_type: woo ? "woocommerce-taxonomy" : "unknown", wp_id: "", page_type: woo ? "woocommerce" : "unclassified", title: c.title, status: "", modified: "",
    content_chars: "", form: "", seo_title: c.title, meta_description: c.description, h1: c.h1, canonical: c.canonical, http_status: c.status,
    action: woo ? "decision-needed" : "review", destination: woo ? ORIGIN + "/shop/" : "", notes: woo ? "WooCommerce archive; redirect to /shop/ or product page" : "Found in sitemap only",
  });
}

const cols = Object.keys(rows[0]);
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
await writeFile("docs/PAGE_INVENTORY.csv", [cols.join(","), ...rows.map((r) => cols.map((k) => esc(r[k])).join(","))].join("\n"));
const by = rows.reduce((a, r) => ((a[`${r.page_type} / ${r.action}`] = (a[`${r.page_type} / ${r.action}`] ?? 0) + 1), a), {});
console.log(`${rows.length} rows`);
console.table(by);
