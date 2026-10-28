import "server-only";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { authors, documents, media, pages, posts, services } from "@/db/schema";
import { isDev } from "@/lib/env";
import { mediaUrl, readHead, usesS3 } from "@/lib/storage";

// Media library helpers: allowed types, file-signature checks, image
// dimensions (parsed from headers, no dependencies), WordPress-style keys and
// "where is this used" lookups.

/** Public media limit (client documents use UPLOAD_MAX_MB instead). */
export const MEDIA_MAX_BYTES = 15 * 1024 * 1024;

export const MEDIA_TYPES: Record<string, { mime: string; kind: "image" | "document" | "video" }> = {
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".pdf": { mime: "application/pdf", kind: "document" },
  ".doc": { mime: "application/msword", kind: "document" },
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "document" },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind: "document" },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", kind: "document" },
  ".mp4": { mime: "video/mp4", kind: "video" },
};

export const ACCEPT_ATTR = Object.keys(MEDIA_TYPES).join(",");

export const extOf = (name: string) => name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";

export function kindOfMime(mime: string): "image" | "document" | "video" | "other" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("application/") || mime.startsWith("text/")) return "document";
  return "other";
}

export function safeMediaFilename(name: string): string {
  const ext = extOf(name);
  const base =
    name
      .slice(0, name.length - ext.length)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "file";
  return `${base}${ext}`;
}

/** Next free key under wp-content/uploads/YYYY/MM/ (adds -1, -2… like WordPress). */
export async function uniqueMediaKey(filename: string, now = new Date()): Promise<string> {
  const safe = safeMediaFilename(filename);
  const ext = extOf(safe);
  const stem = safe.slice(0, safe.length - ext.length);
  const dir = `wp-content/uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const db = await getDb();
  const taken = new Set(
    (await db.select({ key: media.key }).from(media).where(ilike(media.key, `${dir}/${stem}%`))).map((r) => r.key.toLowerCase()),
  );
  for (let i = 0; i < 1000; i++) {
    const key = `${dir}/${i === 0 ? stem : `${stem}-${i}`}${ext}`;
    if (!taken.has(key.toLowerCase())) return key;
  }
  return `${dir}/${stem}-${Date.now()}${ext}`;
}

/** URL the admin uses to preview a file. In local dev, migrated files come from the live host and new uploads from /media/. */
export function adminMediaUrl(row: { key: string; legacyUrl: string | null }): string {
  if (isDev && !usesS3() && !row.legacyUrl) return `/media/${row.key}`;
  return mediaUrl(row.key);
}

// ---------------------------------------------------------------- verification

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  ".jpg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  ".png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".gif": (b) => b.subarray(0, 4).toString("latin1") === "GIF8",
  ".webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
  ".pdf": (b) => b.subarray(0, 4).toString("latin1") === "%PDF",
  ".doc": (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
  ".docx": (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  ".xlsx": (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  ".pptx": (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
  ".mp4": (b) => b.subarray(4, 8).toString("latin1") === "ftyp",
};

export function matchesSignature(ext: string, head: Buffer): boolean {
  return SIGNATURES[ext]?.(head) ?? false;
}

/** Width/height from PNG, GIF, JPEG or WebP headers; null if unknown. */
export function imageSize(ext: string, b: Buffer): { width: number; height: number } | null {
  try {
    if (ext === ".png" && b.length >= 24) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    if (ext === ".gif" && b.length >= 10) return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    if (ext === ".webp" && b.length >= 30) {
      const chunk = b.subarray(12, 16).toString("latin1");
      if (chunk === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const bits = b.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    }
    if (ext === ".jpg" || ext === ".jpeg") {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = b[i + 1];
        // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC).
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        }
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
          i += 2;
          continue;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Reads enough of a stored media object to check its signature and dimensions. */
export async function inspectStoredMedia(key: string, ext: string) {
  const head = await readHead("media", key, 256 * 1024);
  return { validSignature: matchesSignature(ext, head), size: MEDIA_TYPES[ext]?.kind === "image" ? imageSize(ext, head) : null };
}

// ---------------------------------------------------------------- references

export type MediaReference = { type: string; title: string; href: string };

/** Where a media item is used: content HTML/blocks containing its path, and image fields pointing at it. */
export async function mediaReferences(row: { id: string; key: string }): Promise<MediaReference[]> {
  const db = await getDb();
  const keyLike = `%${row.key.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const idLike = `%${row.id}%`;
  const [p, g, s, d, a] = await Promise.all([
    db
      .select({ id: posts.id, title: posts.title })
      .from(posts)
      .where(or(ilike(posts.html, keyLike), eq(posts.featuredImageId, row.id), sql`${posts.seo}->>'ogImageId' = ${row.id}`)),
    db
      .select({ id: pages.id, title: pages.title })
      .from(pages)
      .where(or(sql`${pages.blocks}::text ilike ${keyLike}`, sql`${pages.blocks}::text ilike ${idLike}`, eq(pages.featuredImageId, row.id), sql`${pages.seo}->>'ogImageId' = ${row.id}`)),
    db
      .select({ id: services.id, title: services.title })
      .from(services)
      .where(or(ilike(services.body, keyLike), eq(services.featuredImageId, row.id), sql`${services.seo}->>'ogImageId' = ${row.id}`)),
    db
      .select({ id: documents.id, title: documents.title })
      .from(documents)
      .where(or(ilike(documents.body, keyLike), eq(documents.featuredImageId, row.id), sql`${documents.seo}->>'ogImageId' = ${row.id}`)),
    db.select({ id: authors.id, title: authors.name }).from(authors).where(and(eq(authors.photoId, row.id))),
  ]);
  return [
    ...p.map((x) => ({ type: "Article", title: x.title, href: `/admin/posts/${x.id}/` })),
    ...g.map((x) => ({ type: "Page", title: x.title, href: `/admin/pages/${x.id}/` })),
    ...s.map((x) => ({ type: "Service", title: x.title, href: `/admin/services/${x.id}/` })),
    ...d.map((x) => ({ type: "Legal document", title: x.title, href: `/admin/documents/${x.id}/` })),
    ...a.map((x) => ({ type: "Author photo", title: x.title, href: `/admin/users/authors/${x.id}/` })),
  ];
}
