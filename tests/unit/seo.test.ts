import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import { absoluteUrl, breadcrumbNode, buildMetadata, graph } from "@/lib/seo";
import { parseBlocks } from "@/lib/blocks";

describe("buildMetadata", () => {
  const settings = DEFAULT_SETTINGS;

  it("uses the Yoast-style title pattern and a self-canonical with trailing slash", () => {
    const m = buildMetadata({ settings, path: "/about-us/", title: "About Us" });
    expect(m.title).toEqual({ absolute: "About Us - Lexpraxis Solicitors" });
    expect(m.alternates?.canonical).toBe("https://lexpraxisng.com/about-us/");
  });

  it("prefers imported SEO fields", () => {
    const m = buildMetadata({ settings, path: "/x/", title: "X", seo: { title: "Custom", description: "Desc", canonical: "https://lexpraxisng.com/y/" } });
    expect(m.title).toEqual({ absolute: "Custom" });
    expect(m.description).toBe("Desc");
    expect(m.alternates?.canonical).toBe("https://lexpraxisng.com/y/");
  });

  it("falls back to the default description", () => {
    expect(buildMetadata({ settings, path: "/x/", title: "X" }).description).toBe(settings.seo.defaultDescription);
  });
});

describe("JSON-LD", () => {
  it("builds a breadcrumb list without an item on the last crumb", () => {
    const b = breadcrumbNode("/blog/", [
      { name: "Home", path: "/" },
      { name: "Blog", path: "/blog/" },
    ]);
    expect(b.itemListElement[0]).toMatchObject({ position: 1, item: "https://lexpraxisng.com/" });
    expect(b.itemListElement[1]).not.toHaveProperty("item");
    expect(graph(b, null, false)["@graph"]).toHaveLength(1);
    expect(absoluteUrl("service/")).toBe("https://lexpraxisng.com/service/");
  });
});

describe("page blocks", () => {
  it("validates block shapes and rejects unknown types", () => {
    expect(parseBlocks([{ id: "a", type: "cta", heading: "Hi", primary: { label: "Go", href: "/" }, secondary: {} }])).toHaveLength(1);
    expect(() => parseBlocks([{ id: "a", type: "nope" }])).toThrow();
    expect(() => parseBlocks([{ id: "a", type: "embed", title: "x", url: "javascript:alert(1)" }])).toThrow();
  });
});
