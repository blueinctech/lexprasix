import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { extOf, MEDIA_MAX_BYTES, MEDIA_TYPES, safeMediaFilename, uniqueMediaKey } from "@/lib/admin/media";
import { AuthError, requireUser } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/security/logger";
import { createMediaUploadTarget } from "@/lib/storage";

// Step 1 of a media upload: validate the file's name/size/type and return a
// short-lived upload target. The browser PUTs the file straight to storage
// (no 4.5 MB request limit), then calls finalizeMediaUpload / finalizeMediaReplace.

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ ok: false, error: "Bad origin" }, { status: 403 });
  try {
    const user = await requireUser("media.upload");
    const body = (await request.json()) as { filename?: unknown; size?: unknown; mediaId?: unknown };
    const filename = String(body.filename ?? "").slice(0, 200);
    const size = Number(body.size);
    const ext = extOf(filename);
    const type = MEDIA_TYPES[ext];
    if (!type) return NextResponse.json({ ok: false, error: `File type not allowed. Use: ${Object.keys(MEDIA_TYPES).join(", ")}` }, { status: 400 });
    if (!Number.isFinite(size) || size <= 0 || size > MEDIA_MAX_BYTES) return NextResponse.json({ ok: false, error: "Files must be smaller than 15 MB." }, { status: 400 });

    if (typeof body.mediaId === "string" && body.mediaId) {
      // Replacing: upload to a staging key; the original is only overwritten after verification.
      if (!can(user.role, "media.manage")) return NextResponse.json({ ok: false, error: "You don't have permission to replace files." }, { status: 403 });
      const db = await getDb();
      const [row] = await db.select({ key: media.key }).from(media).where(eq(media.id, body.mediaId));
      if (!row) return NextResponse.json({ ok: false, error: "File not found." }, { status: 404 });
      if (MEDIA_TYPES[extOf(row.key)]?.mime !== type.mime) return NextResponse.json({ ok: false, error: `The replacement must be the same type (${extOf(row.key)}).` }, { status: 400 });
      const uploadKey = `staging/${randomUUID()}/${safeMediaFilename(filename)}`;
      return NextResponse.json({ ok: true, key: row.key, uploadKey, contentType: type.mime, ...(await createMediaUploadTarget(uploadKey, type.mime)) });
    }

    const key = await uniqueMediaKey(filename);
    return NextResponse.json({ ok: true, key, uploadKey: key, contentType: type.mime, ...(await createMediaUploadTarget(key, type.mime)) });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ ok: false, error: err.message }, { status: err.code === "unauthenticated" ? 401 : 403 });
    if (err instanceof ConfigurationError) return NextResponse.json({ ok: false, error: err.message }, { status: 503 });
    logger.error("Media upload sign failed", { err });
    return NextResponse.json({ ok: false, error: "Upload is unavailable right now." }, { status: 500 });
  }
}
