// Copies media from the WordPress site into the new storage (S3/R2 when S3_*
// is set, otherwise .data/media for local development), keeping the original
// "wp-content/uploads/YYYY/MM/file" keys so content and old URLs still resolve.
// Also copies resized variants (-300x200.jpg) that content links to.
//
// Read-only against WordPress; resumable (skips objects that already exist with
// the same size); retries; writes migration/logs/media-<timestamp>.jsonl.
//
//   npm run migrate:media                # everything
//   npm run migrate:media -- --limit 20  # a quick sample
import { appendFile, mkdir } from "node:fs/promises";
import { config } from "dotenv";
import { createDatabase } from "../src/db/client";
import * as s from "../src/db/schema";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
// storage.ts is written for the app; its "server-only" guard is a no-op outside Next bundling.
const storage = await import("../src/lib/storage");

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf("--limit") + 1]) || Infinity;
const ORIGIN = process.env.WP_BASE_URL ?? "https://lexpraxisng.com";
const CONCURRENCY = 4;

const { db, close } = await createDatabase(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL!, { max: 2 });
const rows = await db.select({ key: s.media.key, size: s.media.size, mime: s.media.mimeType }).from(s.media);

// Resized variants referenced from content (WordPress generated these; they are not media rows).
const htmlRows = [...(await db.select({ h: s.posts.html }).from(s.posts)), ...(await db.select({ h: s.services.body }).from(s.services))];
const variants = new Set<string>();
for (const r of htmlRows) for (const m of r.h.matchAll(/(?:src|href)="\/(wp-content\/uploads\/[^"?#]+-\d+x\d+\.\w+)"/g)) variants.add(decodeURIComponent(m[1]));
const known = new Set(rows.map((r) => r.key));
const jobs = [...rows.map((r) => ({ key: r.key, size: r.size, mime: r.mime })), ...[...variants].filter((k) => !known.has(k)).map((k) => ({ key: k, size: 0, mime: "" }))].slice(0, limit);

await mkdir("migration/logs", { recursive: true });
const log = `migration/logs/media-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const stats = { copied: 0, skipped: 0, failed: 0, missing: 0, bytes: 0 };

async function fetchWithRetry(url: string, tries = 4): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "LexPraxisMigration/1.0 (+media copy)" } });
      if (res.status === 404 || res.ok) return res;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const entry: Record<string, unknown> = { key: job.key };
      try {
        const existing = await storage.objectInfo("media", job.key);
        if (existing && (!job.size || existing.size === job.size)) {
          stats.skipped++;
          entry.result = "skipped";
        } else {
          const res = await fetchWithRetry(`${ORIGIN}/${job.key.split("/").map(encodeURIComponent).join("/")}`);
          if (res.status === 404) {
            stats.missing++;
            entry.result = "missing-on-source";
          } else {
            const body = Buffer.from(await res.arrayBuffer());
            await storage.putObject("media", job.key, body, job.mime || res.headers.get("content-type") || "application/octet-stream");
            stats.copied++;
            stats.bytes += body.length;
            entry.result = "copied";
            entry.bytes = body.length;
          }
        }
      } catch (err) {
        stats.failed++;
        entry.result = "failed";
        entry.error = (err as Error).message;
      }
      await appendFile(log, `${JSON.stringify(entry)}\n`);
      const done = stats.copied + stats.skipped + stats.failed + stats.missing;
      if (done % 50 === 0) console.log(`${done}/${jobs.length}`);
    }
  }),
);
console.log({ ...stats, mb: Math.round(stats.bytes / 1e6), total: jobs.length, log, target: storage.usesS3() ? "S3 bucket" : ".data/media (local)" });
await close();
