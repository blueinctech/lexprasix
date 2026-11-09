import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// An editor's everyday job: upload an image, write and publish an article that
// uses it in the body and as the featured image, then see it on the website.

type Account = { email: string; password: string };
const admin = () => (JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<string, Account>).administrator;

/** Picks a file in the media dialog that is currently open. */
async function pick(page: Page, filename: string) {
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("Search media").fill(filename.replace(".jpg", ""));
  await dialog.getByRole("button", { name: filename }).click();
}

test("administrator uploads an image and publishes an article that uses it", async ({ page }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const filename = `e2e-article-image-${stamp}.jpg`;
  const title = `E2E test article ${stamp}`;

  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(admin().email);
  await page.getByLabel(/^Password/).fill(admin().password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });

  // 1. Upload to the media library.
  await page.goto("/admin/media/");
  await page.getByLabel("Choose files to upload").setInputFiles({ name: filename, mimeType: "image/jpeg", buffer: readFileSync("public/theme/hero_1_1.jpg") });
  await expect(page.getByRole("link", { name: new RegExp(String(stamp)) })).toBeVisible({ timeout: 60_000 });

  // 2. Write the article: text, an image in the body, and the featured image.
  await page.goto("/admin/posts/new/");
  await page.getByLabel("Title").first().fill(title);
  const body = page.getByLabel("Article");
  await body.click();
  await page.keyboard.type("This article checks that editors can publish with images.");
  await page.getByRole("button", { name: "Image from media library" }).click();
  await pick(page, filename);
  await page.getByRole("button", { name: "Choose image" }).first().click();
  await pick(page, filename);
  await page.getByLabel("Status").selectOption("published");
  await page.getByRole("button", { name: "Create article" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}\/(\?created=1)?$/, { timeout: 30_000 });

  // 3. The published article shows both images on the website.
  const slug = title.toLowerCase().replace(/\s+/g, "-");
  const res = await page.goto(`/${slug}/`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  const images = page.locator("article img");
  expect(await images.count()).toBeGreaterThanOrEqual(2);
  for (const img of await images.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
  }
});
