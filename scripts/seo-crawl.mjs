// SEO crawler used for the baseline (old site) and the post-migration comparison (new site).
// Read-only. Usage: node scripts/seo-crawl.mjs <urls.txt> <out.csv> [rewriteOrigin]
//   rewriteOrigin: optional origin (e.g. https://preview.vercel.app) that replaces
//   https://lexpraxisng.com in each URL, so the same list can be checked against a preview.
import { readFile, writeFile } from "node:fs/promises";

const [listFile, outFile, rewrite] = process.argv.slice(2);
if (!listFile || !outFile) {
  console.error("Usage: node scripts/seo-crawl.mjs <urls.txt> <out.csv> [rewriteOrigin]");
  process.exit(1);
}
const ORIGIN = "https://lexpraxisng.com";
const UA = "Mozilla/5.0 (compatible; LexPraxisSEOAudit/1.0)";
const CONCURRENCY = 6;

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#0?38;|&amp;/g, "&")
    .replace(/&#8217;|&#039;|&apos;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;|&#160;/g, " ")
    .trim();
const meta = (html, attr, name) => {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "") : "";
};
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function audit(url) {
  const target = rewrite ? url.replace(ORIGIN, rewrite.replace(/\/$/, "")) : url;
  try {
    const first = await fetch(target, { redirect: "manual", headers: { "User-Agent": UA } });
    const redirect = first.headers.get("location") ?? "";
    const res = first.status >= 300 && first.status < 400 ? await fetch(new URL(redirect, target), { headers: { "User-Agent": UA } }) : first;
    const html = (res.headers.get("content-type") ?? "").includes("html") ? await res.text() : "";
    const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
    const h1s = [...body.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")));
    const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
      try {
        const j = JSON.parse(m[1]);
        const nodes = j["@graph"] ?? (Array.isArray(j) ? j : [j]);
        return nodes.map((n) => [n["@type"]].flat().join("+"));
      } catch {
        return ["INVALID"];
      }
    });
    const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
    const internal = new Set([...body.matchAll(/href=["'](https?:\/\/lexpraxisng\.com[^"'#]*|\/[^"'#/][^"'#]*)["']/gi)].map((m) => m[1]));
    const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return {
      url,
      status: first.status,
      redirect,
      finalStatus: res.status,
      title: decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
      description: meta(html, "name", "description"),
      canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ?? "",
      robots: meta(html, "name", "robots"),
      h1Count: h1s.length,
      h1: h1s.join(" | "),
      ogTitle: meta(html, "property", "og:title"),
      ogImage: meta(html, "property", "og:image"),
      schema: [...new Set(ld)].join(" "),
      images: imgs.length,
      imagesMissingAlt: imgs.filter((t) => !/\balt=["'][^"']+["']/i.test(t)).length,
      internalLinks: internal.size,
      words,
    };
  } catch (err) {
    return { url, status: "ERROR", redirect: err.message };
  }
}

const urls = (await readFile(listFile, "utf8")).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const rows = new Array(urls.length);
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < urls.length) {
      const i = next++;
      rows[i] = await audit(urls[i]);
      if ((i + 1) % 50 === 0) console.log(`${i + 1}/${urls.length}`);
    }
  }),
);
const cols = ["url", "status", "redirect", "finalStatus", "title", "description", "canonical", "robots", "h1Count", "h1", "ogTitle", "ogImage", "schema", "images", "imagesMissingAlt", "internalLinks", "words"];
await writeFile(outFile, [cols.join(","), ...rows.map((r) => cols.map((c) => csv(r[c])).join(","))].join("\n"));
console.log(`Wrote ${rows.length} rows to ${outFile}`);
