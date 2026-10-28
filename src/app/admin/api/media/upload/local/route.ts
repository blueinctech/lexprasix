import { NextResponse, type NextRequest } from "next/server";
import { MEDIA_MAX_BYTES } from "@/lib/admin/media";
import { putObject, verifyLocalMediaUploadSig } from "@/lib/storage";

// Development-only stand-in for presigned S3 uploads to the media bucket.
// Refuses when S3 is configured or outside development (see verifyLocalMediaUploadSig).
export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!verifyLocalMediaUploadSig(key, request.nextUrl.searchParams.get("sig") ?? "")) return new NextResponse(null, { status: 403 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > MEDIA_MAX_BYTES) return new NextResponse(null, { status: 413 });
  await putObject("media", key, body, request.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 200 });
}
