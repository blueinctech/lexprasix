import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// The Calendly booking link is set in Admin → Settings → Integrations. Only
// Calendly event links are accepted; with no link, Book Appointment falls back
// to a consultation request form.

type Account = { email: string; password: string };
const admin = () => (JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<string, Account>).administrator;

test("an administrator manages the Calendly link and the booking page falls back to a form", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(admin().email);
  await page.getByLabel("Password").fill(admin().password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });

  await page.goto("/admin/settings/");
  const field = page.getByLabel("Calendly booking link");
  const save = page.getByRole("button", { name: "Save integrations" });

  // A link that isn't a Calendly event page is refused.
  await field.fill("https://example.com/booking");
  await save.click();
  await expect(page.getByRole("alert").filter({ hasText: "Use a Calendly event link" })).toBeVisible();

  // Empty is allowed: the booking page then shows the request form.
  await field.fill("");
  await save.click();
  await expect(page.getByText("Saved", { exact: false }).first()).toBeVisible();

  await page.goto("/book-appointment/");
  await expect(page.getByRole("heading", { name: "Request a consultation" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toBeVisible();
  await expect(page.locator("iframe[src*='calendly.com']")).toHaveCount(0);
});
