// Dev tool: read-only capture of the live WordPress design for side-by-side comparison.
// Read-only capture of the live WordPress design: screenshots + computed styles.
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const out = process.argv[2];
const pages = [
  ["home", "/"], ["about", "/about-us/"], ["service-index", "/service/"], ["service", "/service/company-formation-and-restructuring/"],
  ["blog", "/blog/"], ["post", "/how-to-register-with-fccpc-in-nigeria/"], ["contact", "/contact-us/"], ["booking", "/book-appointment/"],
  ["document", "/company-registration/"], ["legal-forms", "/legal-forms/"], ["privacy", "/privacy-policy/"], ["review", "/review/"],
];
const browser = await chromium.launch({ channel: "msedge" });
const styles = {};
for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    if (vp === "mobile" && !["home", "service", "post", "contact", "document"].includes(name)) continue;
    try {
      await page.goto(`https://lexpraxisng.com${path}`, { waitUntil: "networkidle", timeout: 90000 });
    } catch { /* continue with what loaded */ }
    await page.waitForTimeout(2500);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${name}-${vp}.jpg`, type: "jpeg", quality: 60, fullPage: true });
    if (vp === "desktop") {
      styles[name] = await page.evaluate(() => {
        const pick = (el) => { const s = getComputedStyle(el); return { tag: el.tagName, cls: String(el.className).slice(0, 80), text: el.textContent.trim().slice(0, 70), font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, lh: s.lineHeight, tt: s.textTransform, ls: s.letterSpacing }; };
        const sel = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "a.th-btn", ".th-btn", "header a", "nav a", "footer p", "footer a", "body", ".sub-title", ".breadcumb-title", ".breadcumb-menu"];
        const res = {};
        for (const s of sel) { const els = [...document.querySelectorAll(s)].filter(e => e.offsetParent && e.textContent.trim()).slice(0, 4); if (els.length) res[s] = els.map(pick); }
        const sections = [...document.querySelectorAll("section, .elementor-top-section, .e-con.e-parent, header, footer")].filter(e => e.offsetHeight > 60).slice(0, 40).map(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return { tag: e.tagName, cls: String(e.className).slice(0, 90), top: Math.round(r.top + scrollY), h: Math.round(r.height), bg: s.backgroundColor, bgImg: s.backgroundImage.slice(0, 140), pad: s.padding, text: e.innerText.trim().replace(/\s+/g, " ").slice(0, 90) }; });
        const imgs = [...document.querySelectorAll("img")].filter(i => i.offsetParent && i.naturalWidth > 120).slice(0, 40).map(i => ({ src: i.currentSrc || i.src, alt: i.alt, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), top: Math.round(i.getBoundingClientRect().top + scrollY) }));
        const fonts = [...new Set([...document.querySelectorAll("*")].slice(0, 3000).map(e => getComputedStyle(e).fontFamily))].slice(0, 12);
        return { res, sections, imgs, fonts, height: document.body.scrollHeight };
      });
    }
    console.log("captured", name, vp);
  }
  await ctx.close();
}
await writeFile(`${out}/styles.json`, JSON.stringify(styles, null, 1));
await browser.close();
