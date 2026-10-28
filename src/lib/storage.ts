import "server-only";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ConfigurationError, isDev, mediaBaseUrl } from "@/lib/env";
import { hmac } from "@/lib/security/crypto";

// Two stores:
//  - "media": public website media (images, PDFs). Served from NEXT_PUBLIC_MEDIA_URL.
//  - "uploads": confidential client documents from forms. Never public; staff
//    download through short-lived signed URLs.
// S3-compatible (Cloudflare R2 / AWS S3) when S3_* variables are set. In local
// development without them, files live in .data/<store>/ and are served by
// app/media/[...key] and /api/uploads/local (dev only).

export type Store = "media" | "uploads";

const LOCAL_ROOT = path.join(process.cwd(), ".data");

export function usesS3(): boolean {
  return Boolean(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_MEDIA_BUCKET);
}

function assertConfigured() {
  if (!usesS3() && !isDev) throw new ConfigurationError("S3_ACCESS_KEY_ID", "File storage");
}

let s3: S3Client | null = null;
function client(): S3Client {
  s3 ??= new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
  return s3;
}

function bucket(store: Store): string {
  const name = store === "media" ? process.env.S3_MEDIA_BUCKET : process.env.S3_UPLOADS_BUCKET;
  if (!name) throw new ConfigurationError(store === "media" ? "S3_MEDIA_BUCKET" : "S3_UPLOADS_BUCKET", "File storage");
  return name;
}

/** Rejects keys that could escape the store directory. */
export function safeKey(key: string): string {
  const clean = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!clean || clean.split("/").some((p) => p === ".." || p === "." || p === "") || /[\0<>:"|?*]/.test(clean)) throw new Error("Invalid storage key");
  return clean;
}

function localPath(store: Store, key: string) {
  return path.join(LOCAL_ROOT, store, ...safeKey(key).split("/"));
}

export async function putObject(store: Store, key: string, body: Buffer, contentType: string): Promise<void> {
  assertConfigured();
  if (usesS3()) {
    await client().send(
      new PutObjectCommand({
        Bucket: bucket(store),
        Key: safeKey(key),
        Body: body,
        ContentType: contentType,
        ...(store === "media" ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
      }),
    );
    return;
  }
  const file = localPath(store, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function objectInfo(store: Store, key: string): Promise<{ size: number } | null> {
  assertConfigured();
  try {
    if (usesS3()) {
      const head = await client().send(new HeadObjectCommand({ Bucket: bucket(store), Key: safeKey(key) }));
      return { size: head.ContentLength ?? 0 };
    }
    const s = await stat(localPath(store, key));
    return { size: s.size };
  } catch {
    return null;
  }
}

/** First bytes of an object, for file-signature checks. */
export async function readHead(store: Store, key: string, bytes = 16): Promise<Buffer> {
  assertConfigured();
  if (usesS3()) {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(store), Key: safeKey(key), Range: `bytes=0-${bytes - 1}` }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return (await readFile(localPath(store, key))).subarray(0, bytes);
}

export async function deleteObject(store: Store, key: string): Promise<void> {
  assertConfigured();
  if (usesS3()) {
    await client().send(new DeleteObjectCommand({ Bucket: bucket(store), Key: safeKey(key) }));
    return;
  }
  await unlink(localPath(store, key)).catch(() => undefined);
}

/** Public URL of a media object. */
export function mediaUrl(key: string): string {
  return `${mediaBaseUrl()}/${safeKey(key)}`;
}

/** Browser upload target for a private client document (presigned PUT, or the dev route). */
export async function createUploadTarget(key: string, contentType: string): Promise<{ url: string; headers: Record<string, string> }> {
  assertConfigured();
  if (usesS3()) {
    const url = await getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket("uploads"), Key: safeKey(key), ContentType: contentType }), { expiresIn: 600 });
    return { url, headers: { "Content-Type": contentType } };
  }
  const sig = hmac("local-upload", key).slice(0, 32);
  return { url: `/api/uploads/local/?key=${encodeURIComponent(key)}&sig=${sig}`, headers: { "Content-Type": contentType } };
}

export function verifyLocalUploadSig(key: string, sig: string): boolean {
  return isDev && !usesS3() && sig === hmac("local-upload", key).slice(0, 32);
}

export function verifyLocalDownloadSig(key: string, sig: string, exp: number): boolean {
  return isDev && !usesS3() && exp > Date.now() && sig === hmac("local-download", key, String(exp)).slice(0, 32);
}

/** Short-lived download link for staff (private uploads). */
export async function createDownloadUrl(key: string, filename: string): Promise<string> {
  assertConfigured();
  const disposition = `attachment; filename="${filename.replace(/[^\w.\- ]+/g, "_")}"`;
  if (usesS3()) {
    return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket("uploads"), Key: safeKey(key), ResponseContentDisposition: disposition }), { expiresIn: 300 });
  }
  const exp = Date.now() + 300_000;
  return `/api/uploads/local/?key=${encodeURIComponent(key)}&exp=${exp}&sig=${hmac("local-download", key, String(exp)).slice(0, 32)}`;
}

/** Local dev only: stream a stored file. */
export function localStream(store: Store, key: string): ReadableStream {
  return Readable.toWeb(createReadStream(localPath(store, key))) as ReadableStream;
}

// ---------------------------------------------------------------- public media uploads (admin)

/** Browser upload target for a public media file (presigned PUT, or the dev route). */
export async function createMediaUploadTarget(key: string, contentType: string): Promise<{ url: string; headers: Record<string, string> }> {
  assertConfigured();
  if (usesS3()) {
    const url = await getSignedUrl(client(), new PutObjectCommand({ Bucket: bucket("media"), Key: safeKey(key), ContentType: contentType }), { expiresIn: 600 });
    return { url, headers: { "Content-Type": contentType } };
  }
  const sig = hmac("local-media-upload", key).slice(0, 32);
  return { url: `/admin/api/media/upload/local/?key=${encodeURIComponent(key)}&sig=${sig}`, headers: { "Content-Type": contentType } };
}

export function verifyLocalMediaUploadSig(key: string, sig: string): boolean {
  return isDev && !usesS3() && sig === hmac("local-media-upload", key).slice(0, 32);
}

/** Server-side copy within a store (used to promote a verified replacement file). */
export async function copyObject(store: Store, fromKey: string, toKey: string, contentType?: string): Promise<void> {
  assertConfigured();
  if (usesS3()) {
    await client().send(
      new CopyObjectCommand({
        Bucket: bucket(store),
        CopySource: `${bucket(store)}/${encodeURIComponent(safeKey(fromKey)).replace(/%2F/g, "/")}`,
        Key: safeKey(toKey),
        ...(contentType ? { ContentType: contentType, MetadataDirective: "REPLACE" } : {}),
        ...(store === "media" ? { CacheControl: "public, max-age=31536000, immutable" } : {}),
      }),
    );
    return;
  }
  const to = localPath(store, toKey);
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(localPath(store, fromKey), to);
}
