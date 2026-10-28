import { NextResponse, type NextRequest } from "next/server";
import { isDev } from "@/lib/env";
import { localStream, objectInfo, safeKey, usesS3 } from "@/lib/storage";

// Local development only: serves public media from .data/media when no bucket
// is configured. In production, media is served by the bucket's own domain.
const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", pdf: "application/pdf", mp4: "video/mp4" };

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  if (!isDev || usesS3()) return new NextResponse(null, { status: 404 });
  let key: string;
  try {
    key = safeKey((await params).key.map(decodeURIComponent).join("/"));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!(await objectInfo("media", key))) return new NextResponse(null, { status: 404 });
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(localStream("media", key), {
    headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff", ...(ext === "svg" ? { "Content-Security-Policy": "script-src 'none'" } : {}) },
  });
}
