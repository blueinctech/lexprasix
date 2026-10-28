import { describe, expect, it } from "vitest";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/auth/password";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { addHeadingIds, plainText, sanitizeRichHtml } from "@/lib/sanitize";
import { windowStart } from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/request";
import { safeKey } from "@/lib/storage";
import { safeFilename } from "@/forms/server";

describe("sanitizeRichHtml (stored XSS)", () => {
  it("removes scripts, event handlers and javascript: URLs", () => {
    const html = sanitizeRichHtml(`<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><iframe src="https://evil.example/"></iframe>`);
    expect(html).not.toMatch(/script|onclick|onerror|javascript:|evil\.example/i);
    expect(html).toContain("<p>Hi</p>");
  });
  it("keeps allowed embeds and structure, demotes h1", () => {
    const html = sanitizeRichHtml(`<h1>T</h1><table><tr><td colspan="2">a</td></tr></table><iframe src="https://www.youtube.com/embed/abc"></iframe>`);
    expect(html).toContain("<h2>T</h2>");
    expect(html).toContain('colspan="2"');
    expect(html).toContain("youtube.com/embed/abc");
  });
  it("adds rel=noopener to new-tab links", () => {
    expect(sanitizeRichHtml(`<a href="https://x.com" target="_blank">x</a>`)).toContain('rel="noopener noreferrer"');
  });
  it("builds a table of contents with unique ids", () => {
    const { html, toc } = addHeadingIds("<h2>Fees</h2><h3>Fees</h3>");
    expect(toc.map((t) => t.id)).toEqual(["fees", "fees-2"]);
    expect(html).toContain('id="fees-2"');
  });
  it("plainText decodes entities", () => {
    expect(plainText("<p>Tom&#8217;s &amp; Co</p>")).toBe("Tom’s & Co");
  });
});

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
  it("enforces the password policy", () => {
    expect(newPasswordSchema.safeParse("short").success).toBe(false);
    expect(newPasswordSchema.safeParse("aaaaaaaaaaaaaa").success).toBe(false);
    expect(newPasswordSchema.safeParse("a long memorable sentence").success).toBe(true);
  });
});

describe("permissions", () => {
  it("authors cannot publish, manage users, settings or view enquiries", () => {
    for (const p of ["posts.publish", "users.manage", "settings.manage", "submissions.view", "posts.delete"] as const) expect(can("author", p)).toBe(false);
    expect(can("author", "posts.edit_own")).toBe(true);
  });
  it("editors cannot manage users, settings or export enquiries", () => {
    for (const p of ["users.manage", "settings.manage", "submissions.export", "audit.view"] as const) expect(can("editor", p)).toBe(false);
    expect(can("editor", "submissions.manage")).toBe(true);
  });
  it("administrators can do everything", () => {
    for (const p of Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[]) expect(can("administrator", p)).toBe(true);
  });
});

describe("path and key safety", () => {
  it("rejects open redirects", () => {
    expect(safeRedirectPath("//evil.com", "/admin/")).toBe("/admin/");
    expect(safeRedirectPath("https://evil.com", "/admin/")).toBe("/admin/");
    expect(safeRedirectPath("/admin/posts/", "/admin/")).toBe("/admin/posts/");
  });
  it("rejects storage keys that escape the bucket", () => {
    expect(() => safeKey("../secret")).toThrow();
    expect(() => safeKey("a/../../b")).toThrow();
    expect(safeKey("/wp-content/uploads/2026/01/a.png")).toBe("wp-content/uploads/2026/01/a.png");
  });
  it("normalises uploaded filenames", () => {
    expect(safeFilename("../My CAC Certificate (final).PDF")).toBe("My-CAC-Certificate-final.pdf");
  });
  it("computes fixed rate-limit windows", () => {
    expect(windowStart(1_000_000, 600)).toBe(600_000);
  });
});
