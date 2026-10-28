import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Public journeys and technical SEO on the production build.

const TEMPLATES = [
  ["home", "/"],
  ["service", "/service/company-formation-and-restructuring/"],
  ["services index", "/service/"],
  ["legal document", "/company-registration/"],
  ["documents index", "/legal-forms/"],
  ["blog", "/blog/"],
  ["blog page 2", "/blog/page/2/"],
  ["post", "/how-to-register-with-fccpc-in-nigeria/"],
  ["category", "/category/business-law/"],
  ["author", "/author/janet-okochi/"],
  ["contact", "/contact-us/"],
  ["booking", "/book-appointment/"],
  ["reviews", "/review/"],
  ["about", "/about-us/"],
  ["privacy", "/privacy-policy/"],
] as const;

for (const [name, path] of TEMPLATES) {
  test(`${name} renders with one H1, canonical and no serious accessibility violations`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBe(`https://lexpraxisng.com${path}`);
    expect(await page.locator('script[type="application/ld+json"]').count()).toBeGreaterThan(0);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).exclude("iframe").analyze();
    const serious = axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}

test("unknown URLs return a real 404", async ({ request }) => {
  expect((await request.get("/this-page-does-not-exist/")).status()).toBe(404);
  expect((await request.get("/blog/page/999/")).status()).toBe(404);
});

test("legacy URLs redirect in one hop", async ({ request }) => {
  const cases: [string, string][] = [
    ["/practice-areas/", "/service/"],
    ["/home-full-width/", "/"],
    ["/About-Us/", "/about-us/"],
    ["/?p=12120", "/service/company-formation-and-restructuring/"],
    ["/2026/10/22/", "/blog/"],
    ["/sitemap_index.xml", "/sitemap.xml"],
    ["/?ensaf_header=header-1", "/"],
    ["/appointment-booking/", "/book-appointment/"],
  ];
  for (const [from, to] of cases) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect([301, 308], from).toContain(res.status());
    expect(new URL(res.headers().location, "http://x").pathname, from).toBe(to);
  }
});

test("sitemap, robots and feed are valid", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://lexpraxisng.com/how-to-register-with-fccpc-in-nigeria/</loc>");
  expect(sitemap).not.toContain("/admin/");
  expect(sitemap).not.toContain("ensaf_");
  expect((sitemap.match(/<loc>/g) ?? []).length).toBeGreaterThan(400);
  const feed = await request.get("/feed/");
  expect(feed.headers()["content-type"]).toContain("application/rss+xml");
  const robots = await (await request.get("/robots.txt")).text();
  // Non-production builds must block crawling; production allows it (see docs/QA_REPORT.md).
  expect(robots).toMatch(process.env.SITE_ENV === "production" ? /Allow: \// : /Disallow: \//);
});

test("security headers are present", async ({ request }) => {
  const h = (await request.get("/")).headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("main navigation and legal documents mega-menu work", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Legal Documents" }).click();
  await page.getByRole("link", { name: "Trademark Registration" }).first().click();
  await expect(page).toHaveURL(/\/trademark-registration\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trademark Registration");
});

test("multi-step legal document form validates each step", async ({ page }) => {
  await page.goto("/power-of-attorney/");
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("This field is required.").first()).toBeVisible();
  await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
});

test("contact form submits and confirms with a reference", async ({ page }) => {
  await page.goto("/contact-us/");
  await page.waitForTimeout(2600); // the spam check rejects instant submissions
  await page.getByLabel("Full name").fill("E2E Test Client");
  await page.getByLabel("Email address").first().fill("e2e.client@example.com");
  await page.getByLabel("Phone number").fill("+234 803 000 0000");
  await page.getByLabel("Your message").fill("Automated end-to-end test. Please ignore.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Request received");
  await expect(page.getByRole("status")).toContainText(/LP-[A-Z0-9]{6}/);
});

test("mobile menu opens and navigates @mobile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const dialog = page.getByRole("dialog", { name: "Site menu" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("link", { name: "Blog" }).click();
  await expect(page).toHaveURL(/\/blog\/$/);
  // No horizontal scrolling on phones.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
