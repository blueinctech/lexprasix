import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { submissionFiles } from "@/db/schema";
import { audit } from "@/lib/audit";
import { AuthError, requireUser } from "@/lib/auth/current";
import { createDownloadUrl } from "@/lib/storage";

// Staff download of a client document: checks permission, logs the access and
// redirects to a 5-minute signed URL on the private bucket.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  let user;
  try {
    user = await requireUser("submissions.view");
  } catch (err) {
    return new NextResponse(null, { status: err instanceof AuthError && err.code === "forbidden" ? 403 : 401 });
  }
  const { id, fileId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(fileId)) return new NextResponse(null, { status: 404 });
  const db = await getDb();
  const [file] = await db.select().from(submissionFiles).where(and(eq(submissionFiles.id, fileId), eq(submissionFiles.submissionId, id)));
  if (!file) return new NextResponse(null, { status: 404 });
  await audit({ userId: user.id, action: "submission.file_download", entityType: "submission", entityId: id, details: { fileId } });
  const url = await createDownloadUrl(file.key, file.filename);
  return NextResponse.redirect(new URL(url, _req.url), { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
