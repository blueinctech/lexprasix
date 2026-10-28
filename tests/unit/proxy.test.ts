import { describe, expect, it } from "vitest";
import { contentExists } from "@/proxy";

// The proxy decides which URLs get a real 404 status. These cases mirror the
// public routes; a wrong "false" here would 404 real content.
const k = {
  root: new Set(["how-to-register-with-fccpc-in-nigeria", "company-registration", "about-us"]),
  service: new Set(["company-formation-and-restructuring"]),
  category: new Map([["business-law", 34]]),
  tag: new Map([["cac", 5]]),
  author: new Map([["janet-okochi", 11]]),
  posts: 286,
};

describe("contentExists", () => {
  it.each([
    ["/how-to-register-with-fccpc-in-nigeria/", true],
    ["/company-registration/", true],
    ["/missing-page/", false],
    ["/service/company-formation-and-restructuring/", true],
    ["/service/nope/", false],
    ["/blog/page/24/", true],
    ["/blog/page/25/", false],
    ["/blog/page/1/", false],
    ["/category/business-law/", true],
    ["/category/business-law/page/3/", true],
    ["/category/business-law/page/4/", false],
    ["/tag/cac/", true],
    ["/tag/unknown/", false],
    ["/author/janet-okochi/", true],
    ["/a/b/c/", false],
  ] as const)("%s → %s", (path, expected) => {
    expect(contentExists(k, path)).toBe(expected);
  });

  it.each(["/", "/blog/", "/service/", "/legal-forms/", "/feed/", "/blog/search/", "/admin/posts/", "/api/cron/outbox", "/page-not-found/"])("leaves %s to Next.js", (path) => {
    expect(contentExists(k, path)).toBeNull();
  });
});
