import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { totp } from "../../src/lib/auth/totp";

// Two-factor authentication end to end, with a throwaway editor from global-setup.ts:
// turn it on from My account, sign in again through the code step, turn it off.

type Account = { email: string; password: string };
const account = () => (JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<string, Account>).twofactor;

async function enterPassword(page: Page) {
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(account().email);
  await page.getByLabel(/^Password/).fill(account().password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("staff member turns on two-factor, signs in with a code, and turns it off", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (d) => void d.accept());

  await enterPassword(page);
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });
  await expect(page.getByText("Turn on two-factor authentication", { exact: true })).toBeVisible();

  // Set up: read the manual-entry key and answer with the code an app would show.
  await page.goto("/admin/account/");
  await page.getByRole("button", { name: "Set up two-factor authentication" }).click();
  const key = page.getByTestId("totp-key");
  await expect(key).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
  const secret = (await key.innerText()).replace(/\s/g, "");
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await page.getByRole("textbox", { name: "Code from the app *", exact: true }).fill(totp(secret));
  await page.getByRole("button", { name: "Turn on" }).click();
  const codes = page.getByTestId("recovery-codes").locator("li");
  await expect(codes).toHaveCount(10, { timeout: 20_000 });
  const recovery = await codes.first().innerText();
  expect(recovery).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
  await page.getByRole("button", { name: "I've saved them" }).click();
  await expect(page.getByText(/^On since/)).toBeVisible();

  // Sign out, then sign in: the password alone isn't enough.
  // dispatchEvent: in `next dev` the dev-tools badge covers the sidebar's bottom corner.
  await page.getByRole("button", { name: "Sign out" }).dispatchEvent("click");
  await expect(page).toHaveURL(/\/admin\/login\/$/);
  await enterPassword(page);
  await expect(page).toHaveURL(/\/admin\/login\/verify\/$/, { timeout: 30_000 });
  const codeInput = page.getByLabel("Authentication code");
  await expect(codeInput).toHaveAttribute("autocomplete", "one-time-code");
  await expect(codeInput).toHaveAttribute("inputmode", "numeric");
  expect(await page.context().cookies()).not.toContainEqual(expect.objectContaining({ name: "lp_session" }));
  await codeInput.fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code didn't work.")).toBeVisible();
  // The setup used the current step; the next step's code is within the ±1 window and not a replay.
  await codeInput.fill(totp(secret, Date.now() + 30_000));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/admin\/$/, { timeout: 30_000 });
  await expect(page.getByText("Turn on two-factor authentication", { exact: true })).toHaveCount(0);

  // Turn it off with the password and a recovery code.
  await page.goto("/admin/account/");
  await page.getByLabel("Current password").first().fill(account().password);
  await page.getByLabel("Code from the app or a recovery code").fill(recovery);
  await page.getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Two-factor authentication is off." })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Set up two-factor authentication" })).toBeVisible();
});
