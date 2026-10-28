// Captures QA screenshots of each template (desktop + mobile) and the admin
// into docs/qa-screenshots/. Run against a production build:
//   npx tsx scripts/qa-screenshots.ts http://localhost:3200
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3200";
const out = "docs/qa-screenshots";
await mkdir(out, { recursive: true });

const pages: [string, string][] = [
  ["home", "/"],
  ["service", "/service/company-formation-and-restructuring/"],
  ["document-form", "/company-registration/"],
  ["blog", "/blog/"],
  ["post", "/how-to-register-with-fccpc-in-nigeria/"],
  ["contact", "/contact-us/"],
  ["not-found", "/this-page-does-not-exist/"],
];

const browser = await chromium.launch({ channel: "msedge" });
for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
] as const) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  // Hide the cookie banner so it doesn't cover the content.
  await ctx.addInitScript(() => localStorage.setItem("lp-consent-v1", "denied"));
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${out}/${name}-${label}.jpg`, type: "jpeg", quality: 70, fullPage: label === "desktop" && name === "home" });
  }
  await ctx.close();
}

// Admin (desktop), signed in with the throwaway e2e administrator.
const admin = JSON.parse(readFileSync(".data/e2e-users.json", "utf8")).administrator;
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${base}/admin/login/`);
await page.getByLabel("Email").fill(admin.email);
await page.getByLabel("Password").fill(admin.password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(/\/admin\/$/);
for (const [name, path] of [
  ["admin-dashboard", "/admin/"],
  ["admin-enquiries", "/admin/submissions/"],
  ["admin-posts", "/admin/posts/"],
  ["admin-media", "/admin/media/"],
  ["admin-page-editor", "/admin/pages/"],
] as const) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70 });
}
await browser.close();
console.log(`Screenshots written to ${out}/`);
