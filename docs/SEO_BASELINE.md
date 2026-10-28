# SEO baseline — lexpraxisng.com

**Captured:** 28 October 2026, before any change to the live site.
**Sources:** Yoast sitemap index (10 sub-sitemaps), crawl of all 459 sitemap URLs (`scripts/seo-crawl.mjs` → `migration/baseline/seo-baseline.csv`), `yoast_head_json` from the REST export, manual header checks.
**Not available:** Google Search Console (clicks, impressions, top queries, top landing pages, external links). Without it, the baseline has no traffic weighting, so every indexable URL is treated as important. **Search Console access is requested** to rank URLs by traffic and to find backlinked URLs that are not in the sitemap.

## 1. Index coverage (sitemap)

| Sitemap | URLs | Rebuild |
|---|---|---|
| post-sitemap.xml | 287 (286 posts + `/blog/`) | Keep all URLs |
| page-sitemap.xml | 53 | Keep 44; redirect 2 legacy; WooCommerce pages depend on the shop decision |
| category-sitemap.xml | 18 | Keep |
| post_tag-sitemap.xml | 87 | Keep |
| author-sitemap.xml | 6 | Keep |
| product / product_cat / product_tag | 1 / 1 / 1 | Shop decision |
| ensaf_header / ensaf_footerbuild | 3 / 2 | **Drop from sitemap, 301 to `/`** (theme templates, not content) |

Status codes: 458 × 200, 1 × 302 (`/checkout/` → `/cart/`). No 404s or 5xx.

## 2. On-page signals by template

| Template | URLs | Missing meta description | H1 ≠ 1 | Missing og:image | Self-canonical | Avg words |
|---|---|---|---|---|---|---|
| Home | 1 | 0 | 0 | 0 | 1 | 1,270 |
| Blog posts | 286 | **79** | 1 | 5 | 286 | 1,883 |
| Pages | 41 | **38** | 6 | 38 | 40 | 1,289 |
| Services | 14 | **13** | 0 | 13 | 14 | 543 |
| Categories | 18 | 18 | 0 | 18 | 18 | 933 |
| Tags | 87 | 87 | 0 | 87 | 87 | 809 |
| Authors | 6 | 6 | 0 | 6 | 6 | 1,010 |

- **Title pattern:** `{Title} - Lexpraxis Solicitors` (356 URLs); home is "LexPraxis Solicitors - Nigerian Business Lawyers and Legal Advisor". Keep the pattern, but standardise the brand spelling to "LexPraxis Solicitors" only if the firm agrees (changing it on 356 titles at once is a small, deliberate risk).
- **Robots:** only `/cart/`, `/checkout/`, `/my-account-2/` are `noindex, follow`. Everything else is indexable. Nothing important is blocked.
- **Canonicals:** self-referencing everywhere except `/checkout/` (→ `/cart/`). All canonicals use `https://lexpraxisng.com/…/` with a trailing slash.
- **Multiple H1s:** WooCommerce pages (theme banner + title), one post with an H1 inside its content (`/how-to-register-a-cooperative-society-in-lagos-state/`), and the webinar landing page.
- **Images:** 3,490 `<img>` tags across crawled pages, 268 without alt text. Media Library: 197 of 844 items have alt text.

## 3. Structured data (Yoast graph)

| Template | Types |
|---|---|
| Posts | Article, WebPage, ImageObject, BreadcrumbList, WebSite, Organization, Person (one post adds FAQPage) |
| Pages / services | WebPage, BreadcrumbList, WebSite, Organization (+ ImageObject where a featured image exists) |
| Archives | CollectionPage, BreadcrumbList, WebSite, Organization |
| Authors | ProfilePage, Person, … |

The Organization node has no address or `LegalService`/`LocalBusiness` type. The rebuild will emit the same graph shape, plus a `LegalService` node for each of the three offices **only after the firm confirms the addresses, phone numbers and opening hours**. No `AggregateRating` will be emitted (self-served review markup is not eligible for rich results and the figures are unverified).

## 4. URL rules to preserve

| Rule | Current behaviour | Rebuild |
|---|---|---|
| Protocol / host | `http` and `www` 301 to `https://lexpraxisng.com` | Vercel domain redirect (www → apex), HTTPS enforced |
| Trailing slash | Added by 301 | `trailingSlash: true` |
| Posts | `/{slug}/` at root | Same — a root-level `[slug]` route resolves pages, posts and documents |
| Pages | `/{slug}/`, services `/service/{slug}/` | Same |
| Archives | `/category/{slug}/`, `/tag/{slug}/`, `/author/{slug}/`, `/blog/page/{n}/`, `/category/{slug}/page/{n}/` | Same |
| `?p=ID`, `?page_id=ID` | 301 to permalink | Legacy-ID lookup in the proxy → 301 |
| Date archives | 200 | 301 to `/blog/` |
| `/feed/`, `/category/x/feed/` | RSS | RSS kept at `/feed/`; per-category feeds 301 to `/feed/` |
| `/wp-content/uploads/…` | Files | Proxied/redirected to the new media storage, same paths |
| Uppercase paths | 200 (duplicate) | 301 to lowercase |
| `/sitemap_index.xml` and sub-sitemaps | Yoast | 301 to `/sitemap.xml` |
| `/wp-admin/`, `/wp-login.php` | WP | 302 to `/admin/login` |

## 5. Tracking baseline

GTM `GTM-WXSMSFBP`, GA4 `G-F2X69KFLWM`, Google Ads `AW-17108190829`, Site Kit `GT-KDZB6W45`. No cookie consent banner. Search Console verification method unknown (likely Site Kit/HTML tag) — must be re-verified by DNS before cutover so verification survives the platform change.

## 6. Preservation strategy

1. **Same URLs for every indexable page.** 495 of 503 inventoried URLs keep their exact path. The rest get a 301 to the closest relevant page (never a blanket redirect to `/`, except for the five theme-template URLs that were never content).
2. **Same metadata.** Yoast title, description, canonical, robots, OG and Twitter values are imported per record from `yoast_head_json`. Where Yoast had no description, the new site falls back to the excerpt (posts) or a written summary (services/pages), which is an improvement over today's empty value.
3. **Same internal links.** Content links are rewritten only for media URLs (to the new storage) and for links that currently go through a redirect.
4. **Same structured data shape**, generated from the CMS.
5. **Sitemap parity.** `app/sitemap.ts` lists every published, indexable record; the comparison crawl (`SEO_MIGRATION_REPORT.md`) checks it against `migration/baseline/sitemap-urls.txt`.
6. **No indexing accidents.** Preview deployments send `X-Robots-Tag: noindex`; production does not. A test asserts production `robots.txt` allows crawling.
7. **Post-launch monitoring.** Re-crawl production the day of launch and at +7 and +30 days; watch Search Console coverage and 404s.

Rankings cannot be guaranteed. The goal is to carry over every technical signal and avoid preventable losses.
