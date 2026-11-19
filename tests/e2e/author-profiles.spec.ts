import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// A new writer gets an author profile from the invite form, so their name is
// immediately in the article editor's Author list.

type Account = { email: string; password: string };
const admin = () => (JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<string, Account>).administrator;

test("inviting a writer creates their author profile, ready to pick on an article", async ({ page }) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const name = `Treasure Test ${stamp}`;
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(admin().email);
  await page.getByLabel(/^Password/).fill(admin().password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });

  await page.goto("/admin/users/");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Work email").fill(`writer-${stamp}@example.com`);
  await page.getByLabel("Role").selectOption("author");
  await expect(page.getByLabel(/Writes as/)).toHaveValue("new");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText(/Invitation sent/)).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/users/authors/");
  await expect(page.getByText(name)).toBeVisible();
  await page.goto("/admin/posts/new/");
  await expect(page.getByLabel("Author").locator("option", { hasText: name })).toHaveCount(1);
});
