import { NextResponse, type NextRequest } from "next/server";
import { signUpload } from "@/forms/server";
import { logger } from "@/lib/security/logger";
import { getRequestContext } from "@/lib/security/request";

// Returns a short-lived upload target for one client document. The file goes
// straight to private storage; the submission later claims it by id.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) return NextResponse.json({ ok: false, error: "Bad origin" }, { status: 403 });
  try {
    const body = (await request.json()) as { formId?: unknown; fieldId?: unknown; filename?: unknown; size?: unknown };
    const result = await signUpload(
      { formId: String(body.formId ?? ""), fieldId: String(body.fieldId ?? ""), filename: String(body.filename ?? "").slice(0, 200), size: Number(body.size) },
      await getRequestContext(),
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (err) {
    logger.error("Upload sign failed", { err });
    return NextResponse.json({ ok: false, error: "Upload is unavailable right now. Please try again." }, { status: 500 });
  }
}
