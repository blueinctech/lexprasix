// Compares the WordPress SEO baseline crawl with a crawl of the new site and
// writes docs/SEO_MIGRATION_REPORT.md.
//   node scripts/seo-crawl.mjs migration/baseline/sitemap-urls.txt migration/new-site.csv http://localhost:3200
//   node scripts/seo-compare.mjs migration/baseline/seo-baseline.csv migration/new-site.csv "local production build"
import { readFile, writeFile } from "node:fs/promises";

const [baseFile, newFile, label = "new site"] = process.argv.slice(2);

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
    else if (c !== "\r") f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  const head = rows.shift();
  return new Map(rows.filter((x) => x.length > 1).map((x) => { const o = Object.fromEntries(head.map((k, i) => [k, x[i] ?? ""])); return [o.url, o]; }));
}

const base = parseCsv(await readFile(baseFile, "utf8"));
const next = parseCsv(await readFile(newFile, "utf8"));
const ORIGIN = "https://lexpraxisng.com";
const norm = (s = "") => s.replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/&amp;/g, "&").trim().toLowerCase();
const pathOf = (u) => { try { return new URL(u, ORIGIN).pathname + new URL(u, ORIGIN).search; } catch { return u; } };

const rows = [];
const counts = { total: 0, same200: 0, redirected: 0, missing: 0, titleSame: 0, titleChanged: 0, descSame: 0, descAdded: 0, descChanged: 0, descLost: 0, canonicalOk: 0, canonicalBad: 0, h1Ok: 0, h1Bad: 0, noindexNew: 0, schemaOk: 0 };
for (const [url, b] of base) {
  const n = next.get(url);
  counts.total++;
  const r = { url: pathOf(url), issues: [] };
  if (!n) { r.issues.push("not crawled"); rows.push(r); continue; }
  const status = String(n.status);
  if (status === "200") counts.same200++;
  else if (/^30[1278]$/.test(status)) {
    counts.redirected++;
    r.redirect = `${status} → ${pathOf(n.redirect)}`;
    if (n.finalStatus !== "200") r.issues.push(`redirect target returns ${n.finalStatus}`);
  } else { counts.missing++; r.issues.push(`returns ${status}`); }

  if (status === "200") {
    if (norm(n.title) === norm(b.title)) counts.titleSame++;
    else { counts.titleChanged++; r.title = `“${b.title}” → “${n.title}”`; }
    if (!b.description && n.description) counts.descAdded++;
    else if (b.description && !n.description) { counts.descLost++; r.issues.push("meta description lost"); }
    else if (norm(n.description) === norm(b.description)) counts.descSame++;
    else counts.descChanged++;
    const expectedCanonical = url.replace(/^http:/, "https:");
    if (pathOf(n.canonical) === pathOf(b.canonical || expectedCanonical)) counts.canonicalOk++;
    else { counts.canonicalBad++; r.issues.push(`canonical ${n.canonical || "(none)"} (was ${b.canonical})`); }
    if (n.h1Count === "1") counts.h1Ok++;
    else { counts.h1Bad++; r.issues.push(`${n.h1Count} H1s`); }
    if (/noindex/.test(n.robots) && !/noindex/.test(b.robots)) { counts.noindexNew++; r.issues.push("NEWLY NOINDEX"); }
    const bTypes = new Set(b.schema.split(" ").flatMap((t) => t.split("+")).filter(Boolean));
    const nTypes = new Set(n.schema.split(" ").flatMap((t) => t.split("+")).filter(Boolean));
    const lost = [...bTypes].filter((t) => !nTypes.has(t) && !["ImageObject", "Person", "ProfilePage"].includes(t));
    if (lost.length) r.issues.push(`schema lost: ${lost.join(", ")}`);
    else counts.schemaOk++;
    r.words = `${b.words} → ${n.words}`;
  }
  rows.push(r);
}

const issues = rows.filter((r) => r.issues.length);
const titleChanges = rows.filter((r) => r.title);
const redirects = rows.filter((r) => r.redirect);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const md = `# SEO migration report

Baseline: WordPress crawl of all ${counts.total} sitemap URLs (\`migration/baseline/seo-baseline.csv\`, 28 Oct 2026).
Compared with: ${label} (\`${newFile}\`), generated ${new Date().toISOString()} by \`scripts/seo-compare.mjs\`.

Rankings cannot be guaranteed. This report checks that the technical signals search engines use were carried over.

## Summary

| Check | Result |
|---|---|
| URLs that still return 200 at the same address | ${counts.same200} / ${counts.total} (${pct(counts.same200, counts.total)}) |
| URLs that redirect (single hop) | ${counts.redirected} |
| URLs that now return an error | **${counts.missing}** |
| Same title | ${counts.titleSame} · changed ${counts.titleChanged} |
| Meta description kept | ${counts.descSame} · newly added where WordPress had none ${counts.descAdded} · changed ${counts.descChanged} · **lost ${counts.descLost}** |
| Canonical matches the old canonical | ${counts.canonicalOk} · **different ${counts.canonicalBad}** |
| Exactly one H1 | ${counts.h1Ok} · **other ${counts.h1Bad}** |
| Newly noindexed pages | **${counts.noindexNew}** |
| Structured data types preserved | ${counts.schemaOk} |

## Pages with issues (${issues.length})

${issues.length ? `| URL | Issues |\n|---|---|\n${issues.map((r) => `| ${r.url} | ${r.issues.join("; ")} |`).join("\n")}` : "None."}

## Redirected URLs (${redirects.length})

${redirects.length ? `| Old URL | Redirect |\n|---|---|\n${redirects.map((r) => `| ${r.url} | ${r.redirect} |`).join("\n")}` : "None."}

## Title changes (${titleChanges.length})

${titleChanges.length ? `| URL | Change |\n|---|---|\n${titleChanges.slice(0, 200).map((r) => `| ${r.url} | ${r.title} |`).join("\n")}` : "None."}
`;
await writeFile("docs/SEO_MIGRATION_REPORT.md", md);
console.log(counts);
