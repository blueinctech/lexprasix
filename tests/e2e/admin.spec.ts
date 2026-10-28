import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Admin authentication and server-side authorisation.

type Account = { email: string; password: string };
const accounts = () => JSON.parse(readFileSync(".data/e2e-users.json", "utf8")) as Record<"administrator" | "editor" | "author", Account>;

async function signIn(page: Page, who: keyof ReturnType<typeof accounts>) {
  const a = accounts()[who];
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(a.email);
  await page.getByLabel("Password").fill(a.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
}

test("anonymous visitors are sent to sign-in and admin pages are noindex", async ({ request, page }) => {
  for (const path of ["/admin/", "/admin/submissions/", "/admin/users/", "/admin/settings/"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(307);
    expect(res.headers().location).toContain("/admin/login/");
  }
  await page.goto("/admin/login/");
  expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
});

test("private routes reject requests without a valid session", async ({ request }) => {
  const forged = { headers: { cookie: "lp_session=" + "x".repeat(43) } };
  expect((await request.get("/admin/submissions/export/", { ...forged, maxRedirects: 0 })).status()).toBe(401);
  const sign = await request.post("/admin/api/media/upload/", { ...forged, data: { filename: "a.png", size: 10 }, maxRedirects: 0 });
  expect([401, 403]).toContain(sign.status());
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/admin/login/");
  await page.getByLabel("Email").fill(accounts().editor.email);
  await page.getByLabel("Password").fill("definitely not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
});

test("administrator can sign in, see enquiries and sign out", async ({ page }) => {
  await signIn(page, "administrator");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
  await page.getByRole("link", { name: /Enquiries/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Enquiries" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login\/$/);
  await page.goto("/admin/");
  await expect(page).toHaveURL(/\/admin\/login\//);
});

test("editor cannot open user management or settings", async ({ page }) => {
  await signIn(page, "editor");
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  for (const path of ["/admin/users/", "/admin/settings/", "/admin/activity/"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/\?denied=1$/);
  }
  const exportRes = await page.request.get("/admin/submissions/export/");
  expect(exportRes.status()).toBe(403);
});

test("author cannot see client enquiries", async ({ page }) => {
  await signIn(page, "author");
  await expect(page.getByRole("link", { name: /Enquiries/ })).toHaveCount(0);
  await page.goto("/admin/submissions/");
  await expect(page).toHaveURL(/\/admin\/\?denied=1$/);
});
