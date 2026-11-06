// Brings a database that was imported before the design replication in line
// with the live site's layout: homepage / about / contact sections, header and
// footer menus, service icons and testimonial photos. Safe to re-run.
//
// It overwrites the sections of those three pages and the four menus, so run it
// before editors start changing them (or skip parts with --no-pages / --no-menus).
//
//   npm run design:apply                       (local database)
//   node scripts/with-env.mjs .env.prod.local tsx scripts/apply-live-design.ts
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import * as s from "../src/db/schema";
import { liveMenus, livePageBlocks, SERVICE_ICON_SRC, TESTIMONIAL_PHOTO } from "./live-design";

config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
config({ quiet: true });

const args = new Set(process.argv.slice(2));
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, close } = await createDatabase(url, { max: 1 });

try {
  let seq = 0;
  const blocks = livePageBlocks(() => `live${++seq}`);

  if (!args.has("--no-pages")) {
    for (const [wpId, pageBlocks] of Object.entries(blocks)) {
      // The services index is titled "Service" on the live site.
      const title = Number(wpId) === 53 ? { title: "Service" } : {};
      const rows = await db.update(s.pages).set({ blocks: pageBlocks as s.Block[], ...title }).where(eq(s.pages.wpId, Number(wpId))).returning({ path: s.pages.path });
      console.log(rows.length ? `  ✓ page /${rows[0].path}${rows[0].path ? "/" : ""} sections updated` : `  ✗ page with WordPress id ${wpId} not found`);
    }
  }

  // Live page titles for the generated index pages.
  if (!args.has("--no-pages")) await db.update(s.pages).set({ title: "Legal Forms" }).where(eq(s.pages.wpId, 9083));

  const services = await db.select({ id: s.services.id, slug: s.services.slug, title: s.services.title }).from(s.services);
  let icons = 0;
  for (const svc of services) {
    const icon = SERVICE_ICON_SRC[svc.slug];
    if (!icon) continue;
    await db.update(s.services).set({ icon }).where(eq(s.services.id, svc.id));
    icons++;
  }
  console.log(`  ✓ ${icons} service icons set`);

  let photos = 0;
  for (const [name, photoSrc] of Object.entries(TESTIMONIAL_PHOTO)) {
    const rows = await db.update(s.testimonials).set({ photoSrc }).where(eq(s.testimonials.name, name)).returning({ id: s.testimonials.id });
    photos += rows.length;
  }
  console.log(`  ✓ ${photos} testimonial photos set`);

  // Live footer/contact order of offices, and the Facebook page linked in the live header.
  const [siteRow] = await db.select().from(s.settings).where(eq(s.settings.key, "site"));
  if (siteRow) {
    const site = siteRow.value as { offices?: { city: string }[]; social?: Record<string, string> };
    const order = ["Lagos", "Calabar", "Abuja"];
    if (site.offices) site.offices.sort((a, b) => (order.indexOf(a.city) + 1 || 99) - (order.indexOf(b.city) + 1 || 99));
    if (site.social && !site.social.facebook) site.social.facebook = "https://web.facebook.com/people/Lex-Praxis-Business-Lawyers/100063969975647/";
    await db.update(s.settings).set({ value: site }).where(eq(s.settings.key, "site"));
    console.log("  ✓ office order and Facebook link set");
  }

  if (!args.has("--no-menus")) {
    const docs = await db.select({ slug: s.documents.slug, title: s.documents.title, group: s.documents.group, sortOrder: s.documents.sortOrder }).from(s.documents);
    for (const menu of liveMenus(services, docs)) {
      await db
        .insert(s.menus)
        .values(menu)
        .onConflictDoUpdate({ target: s.menus.key, set: { label: menu.label, items: menu.items } });
    }
    console.log("  ✓ header and footer menus updated");
  }
  console.log("\nDone. Restart the dev server (or wait for the cache to expire) to see the changes.");
} finally {
  await close();
}
