import { desc } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { submissions } from "@/db/schema";
import { getFormDefinition } from "@/forms/registry";
import { fieldsOf } from "@/forms/types";
import { inboxWhere } from "@/lib/admin/submissions";
import { audit } from "@/lib/audit";
import { AuthError, requireUser } from "@/lib/auth/current";

// CSV export of the currently filtered enquiries (administrators only). When a
// single form is selected, each question gets its own column.
const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  // Neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await requireUser("submissions.export");
  } catch (err) {
    return new NextResponse(null, { status: err instanceof AuthError && err.code === "forbidden" ? 403 : 401 });
  }
  const sp = request.nextUrl.searchParams;
  const filter = { q: sp.get("q") ?? undefined, status: sp.get("status") ?? undefined, form: sp.get("form") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined, assigned: sp.get("assigned") ?? undefined };
  const db = await getDb();
  const rows = await db.select().from(submissions).where(inboxWhere(filter, user.id)).orderBy(desc(submissions.createdAt)).limit(10_000);
  const def = filter.form ? getFormDefinition(filter.form) : null;
  const fields = def ? fieldsOf(def).filter((f) => f.type !== "file") : [];
  const header = ["Reference", "Received", "Form", "Status", "Name", "Email", "Phone", ...(def ? fields.map((f) => f.label) : ["Answers"])];
  const lines = rows.map((r) => {
    const data = r.data as Record<string, unknown>;
    const base = [r.reference, r.createdAt.toISOString(), r.formTitle, r.status, r.name, r.email, r.phone];
    const rest = def ? fields.map((f) => data[f.id]) : [Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")];
    return [...base, ...rest].map(cell).join(",");
  });
  await audit({ userId: user.id, action: "submission.export", entityType: "submission", details: { count: rows.length, form: filter.form ?? null, status: filter.status ?? null } });
  const name = `lexpraxis-enquiries-${filter.form ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(`﻿${[header.map(cell).join(","), ...lines].join("\r\n")}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
  });
}
