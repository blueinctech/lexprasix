import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Writing tools in the article editor: live SEO/readability analysis, YouTube
// videos, uploading an image without leaving the editor, and Save & preview.

type Account = { email: string; password: string };
const admin = () => (JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<string, Account>).administrator;

test("an editor writes with live analysis, a YouTube video and an uploaded image, then previews", async ({ page }) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(admin().email);
  await page.getByLabel(/^Password/).fill(admin().password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });

  await page.goto("/admin/posts/new/");
  await page.getByLabel("Title").first().fill(`How to register a company in Nigeria ${stamp}`);
  await page.getByLabel("Article").click();
  await page.keyboard.type("How to register a company in Nigeria is a common question. This guide explains the steps, the documents you need and how long it takes.");

  // Live analysis: readability straight away, SEO once a focus keyphrase is set.
  const panel = page.locator("div").filter({ has: page.getByRole("heading", { name: "SEO & readability" }) }).last();
  await panel.getByRole("tab", { name: /Readability/ }).click();
  await expect(panel.getByText(/Sentence length|Paragraph length/).first()).toBeVisible({ timeout: 60_000 });
  await panel.getByRole("tab", { name: /SEO/ }).click();
  await expect(panel.getByText("Enter a focus keyphrase")).toBeVisible();
  await panel.getByLabel("Focus keyphrase").fill("register a company in Nigeria");
  await expect(panel.getByText(/Keyphrase in introduction/)).toBeVisible({ timeout: 30_000 });

  // YouTube video from a pasted link.
  page.once("dialog", (d) => d.accept("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  await page.getByRole("button", { name: "YouTube video" }).click();
  await expect(page.locator('.ProseMirror iframe[src*="youtube"]')).toHaveCount(1);

  // Upload an image from inside the picker; it's inserted without leaving the editor.
  await page.getByRole("button", { name: "Image from media library" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[type="file"]').setInputFiles({ name: `editor-upload-${stamp}.jpg`, mimeType: "image/jpeg", buffer: readFileSync("public/theme/hero_1_1.jpg") });
  await expect(page.locator(".ProseMirror img")).toHaveCount(1, { timeout: 60_000 });

  // Save & preview keeps it a draft and opens the preview.
  await page.getByRole("button", { name: "Save & preview" }).click();
  await expect(page).toHaveURL(/\/admin\/preview\/post\/[0-9a-f-]{36}\/$/, { timeout: 60_000 });
  await expect(page.locator('iframe[src*="youtube"]')).toHaveCount(1);
  await page.getByRole("link", { name: /Back to editor/ }).click();
  await expect(page.getByLabel("Focus keyphrase")).toHaveValue("register a company in Nigeria", { timeout: 30_000 });
});
