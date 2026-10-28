// Exports public WordPress content from lexpraxisng.com through the REST API.
// Read-only: only issues GET requests. Safe to rerun; overwrites the output folder.
// Usage: node scripts/wp-export.mjs [outDir]
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.WP_BASE_URL ?? "https://lexpraxisng.com";
const OUT = process.argv[2] ?? "migration/wp-export";
const UA = "LexPraxisMigration/1.0 (+read-only export)";

const COLLECTIONS = {
  posts: "/wp-json/wp/v2/posts?context=view&_embed=0",
  pages: "/wp-json/wp/v2/pages?context=view",
  media: "/wp-json/wp/v2/media?context=view",
  categories: "/wp-json/wp/v2/categories?context=view",
  tags: "/wp-json/wp/v2/tags?context=view",
  users: "/wp-json/wp/v2/users?context=view",
  product: "/wp-json/wp/v2/product?context=view",
  product_cat: "/wp-json/wp/v2/product_cat?context=view",
  comments: "/wp-json/wp/v2/comments?context=view",
  e_floating_buttons: "/wp-json/wp/v2/e-floating-buttons?context=view",
};

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (res.status === 401 || res.status === 403 || res.status === 404) return { res, data: null };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { res, data: await res.json() };
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

async function fetchAll(name, route) {
  const items = [];
  for (let page = 1; ; page++) {
    const sep = route.includes("?") ? "&" : "?";
    const { res, data } = await get(`${BASE}${route}${sep}per_page=100&page=${page}`);
    if (!data) {
      if (page === 1) console.warn(`  ${name}: not public (HTTP ${res.status})`);
      break;
    }
    items.push(...data);
    const totalPages = Number(res.headers.get("x-wp-totalpages") ?? 1);
    if (page >= totalPages) break;
  }
  return items;
}

await mkdir(OUT, { recursive: true });
const summary = {};
for (const [name, route] of Object.entries(COLLECTIONS)) {
  const items = await fetchAll(name, route);
  summary[name] = items.length;
  await writeFile(path.join(OUT, `${name}.json`), JSON.stringify(items, null, 2));
  console.log(`${name}: ${items.length}`);
}
summary.exportedAt = new Date().toISOString();
summary.source = BASE;
await writeFile(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
