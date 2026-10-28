import { NextResponse, type NextRequest } from "next/server";
import { uploadMaxBytes } from "@/lib/env";
import { localStream, putObject, verifyLocalDownloadSig, verifyLocalUploadSig } from "@/lib/storage";

// Development-only stand-in for presigned S3 URLs (refuses to work when S3 is
// configured or in production builds; see verifyLocal*Sig).

export async function PUT(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  if (!verifyLocalUploadSig(key, request.nextUrl.searchParams.get("sig") ?? "")) return new NextResponse(null, { status: 403 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > uploadMaxBytes()) return new NextResponse(null, { status: 413 });
  await putObject("uploads", key, body, request.headers.get("content-type") ?? "application/octet-stream");
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") ?? "";
  const exp = Number(request.nextUrl.searchParams.get("exp"));
  if (!verifyLocalDownloadSig(key, request.nextUrl.searchParams.get("sig") ?? "", exp)) return new NextResponse(null, { status: 403 });
  return new NextResponse(localStream("uploads", key), {
    headers: { "Content-Disposition": `attachment; filename="${key.split("/").pop()}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
