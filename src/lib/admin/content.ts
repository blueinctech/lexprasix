import "server-only";
import { updateTag } from "next/cache";
import { TAGS } from "@/lib/content/queries";

// Cache refresh after admin edits (Server Actions only). Each public query is
// tagged in src/lib/content/queries.ts; this expires exactly what changed so the
// public site shows the edit on the next request.
export function refreshPublic(...tags: (keyof typeof TAGS | (string & {}))[]) {
  for (const t of new Set(tags)) updateTag(t in TAGS ? TAGS[t as keyof typeof TAGS] : t);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Root-level slugs the public site reserves for its own routes. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "blog", "service", "category", "tag", "author", "feed", "media", "legal-forms", "corporate-filings",
  "sitemap.xml", "robots.txt", "wp-admin", "wp-content", "wp-login.php", "_next", "page-not-found",
]);
