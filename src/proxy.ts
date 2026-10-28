import { NextResponse, type NextRequest } from "next/server";

// Runs before every page request (Node.js runtime):
//  1. Admin gate: no session cookie → sign-in page. The real authorisation
//     check happens next to the data (requireUser / requireUserPage).
//  2. Legacy WordPress URLs that need a lookup or normalisation:
//     ?p=ID / ?page_id=ID, theme template query strings, uppercase paths.
//  3. Non-production deployments are sent with noindex.

const SESSION_COOKIE = "lp_session";
const PUBLIC_ADMIN = /^\/admin\/(login|forgot-password|reset-password|accept-invite)(\/|$)/;
const isProduction = process.env.SITE_ENV === "production";

async function legacyPath(id: number): Promise<string | null> {
  try {
    const { getDb } = await import("@/db");
    const { legacyIds } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    const [row] = await db.select({ path: legacyIds.path }).from(legacyIds).where(eq(legacyIds.wpId, id));
    return row?.path ?? null;
  } catch {
    return null;
  }
}

function withHeaders(res: NextResponse, admin = false) {
  if (!isProduction || admin) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!PUBLIC_ADMIN.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
      const login = new URL("/admin/login/", request.url);
      if (request.method === "GET" && pathname !== "/admin/") login.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    return withHeaders(NextResponse.next(), true);
  }

  // WordPress short links: /?p=123, /?page_id=123
  const legacyId = searchParams.get("p") ?? searchParams.get("page_id");
  if (legacyId && /^\d{1,9}$/.test(legacyId)) {
    const target = await legacyPath(Number(legacyId));
    if (target) return NextResponse.redirect(new URL(target, request.url), 301);
  }
  // Theme header/footer templates that Yoast listed in the sitemap.
  if (searchParams.has("ensaf_header") || searchParams.has("ensaf_footerbuild")) {
    return NextResponse.redirect(new URL("/", request.url), 301);
  }
  // /About-Us/ → /about-us/ (WordPress served both; keep one canonical URL).
  if (/[A-Z]/.test(pathname) && !pathname.startsWith("/_next") && !pathname.startsWith("/media/") && !/\.[a-z0-9]+$/i.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 301);
  }
  return withHeaders(NextResponse.next());
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|robots.txt|sitemap.xml).*)"],
};
