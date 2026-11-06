// Dev tool: screen-sized clips down a full page (read-only), for design comparison.
//   node scripts/capture-live-slices.mjs <outDir> <origin> <name> <path> [maxSlices]
import { chromium } from "@playwright/test";
const [out, origin, name, path, max = "12"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.addInitScript(() => { try { localStorage.setItem("lp-consent-v1", "denied"); } catch {} });
try { await page.goto(origin + path, { waitUntil: "networkidle", timeout: 90000 }); } catch {}
await page.waitForTimeout(3000);
// Scroll through once so lazy images load.
for (let y = 0; y < (await page.evaluate(() => document.body.scrollHeight)); y += 700) { await page.evaluate((v) => scrollTo(0, v), y); await page.waitForTimeout(150); }
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(1500);
// Trigger lazy content by taking one full-page capture first.
const full = await page.screenshot({ fullPage: true, type: "jpeg", quality: 10 });
const size = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, ...[...document.querySelectorAll("body > *")].map((e) => e.getBoundingClientRect().bottom + scrollY)) }));
let i = 0;
for (let y = 0; y < size.h && i < Number(max); y += 880, i++) {
  await page.screenshot({ path: `${out}/${name}-s${i}.jpg`, type: "jpeg", quality: 65, fullPage: true, clip: { x: 0, y, width: 1440, height: Math.min(900, size.h - y) } });
}
console.log(name, "height", size.h, "slices", i, "full bytes", full.length);
await browser.close();
