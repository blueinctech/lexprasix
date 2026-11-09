import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The shop kept from WooCommerce: one ebook, an order request form while no
// payment link is set, and the old WooCommerce URLs redirecting to /shop/.

const PRODUCT = "/product/essential-tax-guide-for-businesses-in-nigeria-ebook/";
const TITLE = "Essential Tax Guide For Businesses in Nigeria (eBook)";

test("shop lists the ebook", async ({ page }) => {
  const res = await page.goto("/shop/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shop");
  const link = page.getByRole("link", { name: TITLE });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", PRODUCT);
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", /\/shop\/$/);
});

test("product page shows the cover, price and description", async ({ page }) => {
  const res = await page.goto(PRODUCT);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  // The cover comes from the imported WordPress media (last-book.png).
  const cover = page.locator('img[src*="last-book"]').first();
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute("alt", /\S/);
  await expect(page.getByTestId("product-price")).not.toBeEmpty();
  await expect(page.getByRole("heading", { name: "About the Book" })).toBeVisible();
  await expect(page.locator(".prose-lp ol li")).toHaveCount(5);
  await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", new RegExp(`${PRODUCT}$`));
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toContain('"Book"');
});

test("order request goes to enquiries with the product name", async ({ page }) => {
  await page.goto(PRODUCT);
  const order = page.locator("#order");
  // Only shown while the product has no payment link.
  test.skip((await order.count()) === 0, "This product has a payment link");
  await expect(order.getByLabel("Product")).toHaveValue(TITLE);
  await page.waitForTimeout(2600); // the spam check rejects instant submissions
  await order.getByLabel("Full name").fill("E2E Shop Client");
  await order.getByLabel("Email address").fill("e2e.shop@example.com");
  await order.getByLabel("Phone number").fill("+234 803 000 0000");
  await order.getByLabel("Anything else?").fill("Automated end-to-end test. Please ignore.");
  await order.getByRole("button", { name: "Request this eBook" }).click();
  await expect(page.getByRole("status")).toContainText("Request received");
  await expect(page.getByRole("status")).toContainText(/LP-[A-Z0-9]{6}/);
});

for (const legacy of ["/cart/", "/checkout/", "/my-account-2/", "/product-category/books/", "/product-tag/essential-tax-guide/"]) {
  test(`${legacy} redirects to /shop/ in one hop`, async ({ request }) => {
    const res = await request.get(legacy, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(new URL(res.headers().location, "http://x").pathname).toBe("/shop/");
  });
}

test("administrator sees the ebook under Admin → Shop", async ({ page }) => {
  const admin = (JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<string, { email: string; password: string }>).administrator;
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(admin.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });
  await page.goto("/admin/products/");
  await page.getByRole("link", { name: TITLE }).click();
  await expect(page).toHaveURL(/\/admin\/products\/[0-9a-f-]{36}\/$/, { timeout: 60_000 });
  await expect(page.getByLabel("Buy link")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel("Price shown")).toBeVisible();
});
