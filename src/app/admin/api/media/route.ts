import { and, count, desc, ilike, like, or, type SQL } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { AuthError, requireUser } from "@/lib/auth/current";
import { mediaBaseUrl } from "@/lib/env";

// Media search for the picker in the editors. Staff only.
export async function GET(request: NextRequest) {
  try {
    await requireUser("media.upload");
  } catch (err) {
    const status = err instanceof AuthError && err.code === "forbidden" ? 403 : 401;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }
  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(500, Number(sp.get("page")) || 1));
  const imagesOnly = sp.get("type") !== "all";
  const perPage = 30;
  const conds: (SQL | undefined)[] = [];
  if (q) conds.push(or(ilike(media.filename, `%${q}%`), ilike(media.alt, `%${q}%`), ilike(media.caption, `%${q}%`)));
  if (imagesOnly) conds.push(like(media.mimeType, "image/%"));
  const where = and(...conds);
  const db = await getDb();
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(media).where(where),
    db
      .select({ id: media.id, key: media.key, filename: media.filename, alt: media.alt, width: media.width, height: media.height, mimeType: media.mimeType })
      .from(media)
      .where(where)
      .orderBy(desc(media.createdAt), desc(media.key))
      .limit(perPage)
      .offset((page - 1) * perPage),
  ]);
  const base = mediaBaseUrl();
  return NextResponse.json(
    { items: rows.map(({ key, ...r }) => ({ ...r, url: `${base}/${key}` })), total: n, page, pages: Math.max(1, Math.ceil(n / perPage)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
