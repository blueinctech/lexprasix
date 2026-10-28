import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

// Runs before every page request (Node.js runtime):
//  1. Admin gate: no session cookie → sign-in page. The real authorisation
//     check happens next to the data (requireUser / requireUserPage).
//  2. Redirects managed in Admin → Redirects, and legacy WordPress URLs that
//     need a lookup or normalisation (?p=ID, theme query strings, uppercase).
//     Done here, not in a page, so every redirect is a real single-hop HTTP
//     redirect with a Location header.
//  3. Non-production deployments are sent with noindex.

const SESSION_COOKIE = "lp_session";
const PUBLIC_ADMIN = /^\/admin\/(login|forgot-password|reset-password|accept-invite)(\/|$)/;
const isProduction = process.env.SITE_ENV === "production";

type RedirectRule = { destination: string; statusCode: number };
const REDIRECT_TTL_MS = 60_000;
let redirectCache: { at: number; map: Map<string, RedirectRule> } | null = null;
let redirectLoad: Promise<Map<string, RedirectRule>> | null = null;

async function db() {
  const [{ getDb }, schema, orm] = await Promise.all([import("@/db"), import("@/db/schema"), import("drizzle-orm")]);
  return { db: await getDb(), schema, orm };
}

/** All admin-managed redirects, refreshed at most once a minute per server instance. */
async function redirectMap(): Promise<Map<string, RedirectRule>> {
  if (redirectCache && Date.now() - redirectCache.at < REDIRECT_TTL_MS) return redirectCache.map;
  redirectLoad ??= (async () => {
    try {
      const { db: conn, schema } = await db();
      const rows = await conn.select({ source: schema.redirects.source, destination: schema.redirects.destination, statusCode: schema.redirects.statusCode }).from(schema.redirects);
      const map = new Map(rows.map((r) => [r.source, { destination: r.destination, statusCode: r.statusCode }]));
      redirectCache = { at: Date.now(), map };
      return map;
    } catch {
      // Keep serving the last good copy if the database is briefly unavailable.
      return redirectCache?.map ?? new Map();
    } finally {
      redirectLoad = null;
    }
  })();
  return redirectLoad;
}

async function countHit(source: string) {
  try {
    const { db: conn, schema, orm } = await db();
    await conn.update(schema.redirects).set({ hits: orm.sql`${schema.redirects.hits} + 1`, lastHitAt: new Date() }).where(orm.eq(schema.redirects.source, source));
  } catch {
    /* best effort */
  }
}

async function legacyPath(id: number): Promise<string | null> {
  try {
    const { db: conn, schema, orm } = await db();
    const [row] = await conn.select({ path: schema.legacyIds.path }).from(schema.legacyIds).where(orm.eq(schema.legacyIds.wpId, id));
    return row?.path ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- real 404 status
// A streamed page keeps the 200 status it started with, even when it then
// renders "not found" (a soft 404). The proxy knows which content URLs exist
// and answers missing ones itself: the static /page-not-found/ HTML with a 404
// status. Known URLs are cached for a minute; a miss reloads before deciding,
// so newly published content is never 404'd.

type Known = { at: number; root: Set<string>; service: Set<string>; category: Map<string, number>; tag: Map<string, number>; author: Map<string, number>; posts: number };
let known: Known | null = null;
let knownLoad: Promise<Known | null> | null = null;
const PER_PAGE = 12;
const STATIC_ROOT = new Set(["blog", "service", "legal-forms", "corporate-filings", "feed", "admin", "api", "media", "category", "tag", "author", "page-not-found"]);
const LIVE = (t: string) => `${t}.status = 'published' and ${t}.published_at <= now()`;

async function loadKnown(force = false): Promise<Known | null> {
  if (known && Date.now() - known.at < (force ? 5_000 : REDIRECT_TTL_MS)) return known;
  knownLoad ??= (async () => {
    try {
      const { db: conn, orm } = await db();
      const q = <T,>(text: string) => conn.execute(orm.sql.raw(text)) as unknown as Promise<T[]>;
      const [root, svc, cat, tag, auth, total] = await Promise.all([
        q<{ s: string }>(`select p.slug as s from posts p where ${LIVE("p")} union select d.slug from documents d where ${LIVE("d")} union select g.path from pages g where ${LIVE("g")} and g.template <> 'index' and g.path <> ''`),
        q<{ s: string }>(`select v.slug as s from services v where ${LIVE("v")}`),
        q<{ s: string; n: number }>(`select c.slug as s, count(*)::int as n from post_categories pc join categories c on c.id = pc.category_id join posts p on p.id = pc.post_id where ${LIVE("p")} group by c.slug`),
        q<{ s: string; n: number }>(`select t.slug as s, count(*)::int as n from post_tags pt join tags t on t.id = pt.tag_id join posts p on p.id = pt.post_id where ${LIVE("p")} group by t.slug`),
        q<{ s: string; n: number }>(`select a.slug as s, count(*)::int as n from posts p join authors a on a.id = p.author_id where ${LIVE("p")} group by a.slug`),
        q<{ n: number }>(`select count(*)::int as n from posts p where ${LIVE("p")}`),
      ]);
      known = {
        at: Date.now(),
        root: new Set(root.map((r) => r.s)),
        service: new Set(svc.map((r) => r.s)),
        category: new Map(cat.map((r) => [r.s, r.n])),
        tag: new Map(tag.map((r) => [r.s, r.n])),
        author: new Map(auth.map((r) => [r.s, r.n])),
        posts: total[0]?.n ?? 0,
      };
      return known;
    } catch {
      return known; // database unavailable: let the page decide
    } finally {
      knownLoad = null;
    }
  })();
  return knownLoad;
}

/** true = exists, false = definitely missing, null = not a content URL (let Next decide). */
export function contentExists(k: Omit<Known, "at">, path: string): boolean | null {
  const parts = path.split("/").filter(Boolean);
  const pageOk = (n: string | undefined, total: number) => n === undefined || (/^\d+$/.test(n) && Number(n) >= 2 && Number(n) <= Math.ceil(total / PER_PAGE));
  if (parts.length === 0) return null;
  if (["admin", "api", "media", "_next"].includes(parts[0])) return null;
  if (parts.length === 1) return STATIC_ROOT.has(parts[0]) ? null : k.root.has(parts[0]);
  if (parts[0] === "blog") return parts[1] === "search" ? null : parts[1] === "page" && parts.length === 3 ? pageOk(parts[2], k.posts) : false;
  if (parts[0] === "service") return parts.length === 2 && k.service.has(parts[1]);
  if (["category", "tag", "author"].includes(parts[0])) {
    if (!(parts.length === 2 || (parts.length === 4 && parts[2] === "page"))) return false;
    const total = (parts[0] === "category" ? k.category : parts[0] === "tag" ? k.tag : k.author).get(parts[1]);
    return total !== undefined && pageOk(parts[3], total);
  }
  // Every other path is only matched by the catch-all, which has nothing to show.
  return false;
}

async function notFoundResponse(request: NextRequest): Promise<NextResponse> {
  try {
    const page = await fetch(new URL("/page-not-found/", request.url), { headers: { "x-lp-internal": "404" } });
    return new NextResponse(page.body, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex", "Cache-Control": "public, max-age=0, s-maxage=60" } });
  } catch {
    return new NextResponse("Page not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

function withHeaders(res: NextResponse, admin = false) {
  if (!isProduction || admin) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!PUBLIC_ADMIN.test(pathname) && !request.cookies.has(SESSION_COOKIE)) {
      const login = new URL("/admin/login/", request.url);
      if (request.method === "GET" && pathname !== "/admin/") login.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    return withHeaders(NextResponse.next(), true);
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/media/")) return NextResponse.next();

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
  // Redirects managed in the admin (paths are stored lowercase with a trailing slash).
  if (request.method === "GET" || request.method === "HEAD") {
    let key = pathname.toLowerCase();
    try {
      key = decodeURIComponent(key);
    } catch {
      /* keep raw */
    }
    if (!key.endsWith("/") && !/\.[a-z0-9]+$/.test(key)) key += "/";
    const rule = (await redirectMap()).get(key);
    if (rule) {
      event.waitUntil(countHit(key));
      return NextResponse.redirect(new URL(rule.destination, request.url), rule.statusCode);
    }
  }
  // /About-Us/ → /about-us/ (WordPress served both; keep one canonical URL).
  if (/[A-Z]/.test(pathname) && !pathname.startsWith("/_next") && !/\.[a-z0-9]+$/i.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.toLowerCase();
    return NextResponse.redirect(url, 301);
  }
  // Missing content: real 404 status (see notFoundResponse).
  if ((request.method === "GET" || request.method === "HEAD") && !/\.[a-z0-9]+$/i.test(pathname) && !request.headers.has("rsc")) {
    let path = pathname;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      /* keep raw */
    }
    const k = await loadKnown();
    if (k && contentExists(k, path) === false) {
      const fresh = await loadKnown(true);
      if (fresh && contentExists(fresh, path) === false) return notFoundResponse(request);
    }
  }
  return withHeaders(NextResponse.next());
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|brand/|robots.txt|sitemap.xml).*)"],
};
