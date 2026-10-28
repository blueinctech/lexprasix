import sanitizeHtml from "sanitize-html";

// Allow-list sanitiser for rich text: applied when content is saved from the
// admin, when WordPress content is imported, and again when rendering (defence
// in depth). Free of "server-only" so migration scripts can use it.

const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com", "maps.google.com"];

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "a", "strong", "em", "b", "i", "u", "s", "sub", "sup", "mark",
      "br", "hr", "blockquote", "cite", "code", "pre", "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td",
      "img", "figure", "figcaption", "iframe", "div",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "id"],
      img: ["src", "alt", "width", "height", "loading"],
      iframe: ["src", "title", "allow", "allowfullscreen", "width", "height", "loading"],
      th: ["colspan", "rowspan", "scope"],
      td: ["colspan", "rowspan"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      div: ["data-embed"],
      ol: ["start"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    allowedIframeHostnames: EMBED_HOSTS,
    transformTags: {
      h1: "h2",
      a: (_tag, attribs) => {
        const external = attribs.target === "_blank";
        return {
          tagName: "a",
          attribs: {
            href: attribs.href ?? "",
            ...(external ? { target: "_blank" } : {}),
            ...(attribs.rel ? { rel: attribs.rel.includes("noopener") || !external ? attribs.rel : `${attribs.rel} noopener` } : external ? { rel: "noopener noreferrer" } : {}),
          },
        };
      },
      img: (_tag, attribs) => ({
        tagName: "img",
        attribs: {
          src: attribs.src ?? "",
          alt: attribs.alt ?? "",
          loading: "lazy",
          ...(attribs.width && /^\d+$/.test(attribs.width) ? { width: attribs.width } : {}),
          ...(attribs.height && /^\d+$/.test(attribs.height) ? { height: attribs.height } : {}),
        },
      }),
      iframe: (_tag, attribs) => ({ tagName: "iframe", attribs: { ...attribs, loading: "lazy" } }),
    },
    exclusiveFilter: (frame) => (frame.tag === "img" && !frame.attribs.src) || (frame.tag === "a" && !frame.attribs.href && !frame.text.trim()),
  })
    .replace(/<p>(\s|&nbsp;|<br \/>)*<\/p>/g, "")
    .trim();
}

/** Plain text (for excerpts, SEO fields, search). */
export function plainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&#039;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function readingMinutes(html: string): number {
  return Math.max(1, Math.round(plainText(html).split(" ").length / 225));
}

/** Adds ids to h2/h3 so the article table of contents can link to them. */
export function addHeadingIds(html: string): { html: string; toc: { id: string; text: string; level: number }[] } {
  const toc: { id: string; text: string; level: number }[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (_m, level: string, attrs: string | undefined, inner: string) => {
    const text = plainText(inner);
    let id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "section";
    while (used.has(id)) id += "-2";
    used.add(id);
    toc.push({ id, text, level: Number(level) });
    const cleanAttrs = (attrs ?? "").replace(/\sid="[^"]*"/, "");
    return `<h${level}${cleanAttrs} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}
