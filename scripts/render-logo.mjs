// Dev tool: renders public/theme/Lexpraxis-new.svg (500 KB, embedded bitmaps) to a
// small transparent PNG for the header/footer.  node scripts/render-logo.mjs
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const svg = readFileSync("public/theme/Lexpraxis-new.svg", "utf8");
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ deviceScaleFactor: 3 });
await page.setContent(`<html><body style="margin:0;background:transparent"><div id="l" style="width:240px;height:79px">${svg.replace(/<\?xml[^>]*>/, "").replace("<svg ", '<svg width="240" height="79" ')}</div></body></html>`);
await page.locator("#l").screenshot({ path: "public/theme/lexpraxis-logo.png", omitBackground: true });
await browser.close();
console.log("wrote public/theme/lexpraxis-logo.png");
