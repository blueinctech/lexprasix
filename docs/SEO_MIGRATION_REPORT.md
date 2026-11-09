# SEO migration report

Baseline: WordPress crawl of all 459 sitemap URLs (`migration/baseline/seo-baseline.csv`, 28 Oct 2026).
Compared with: live site after launch (lexpraxisng.com on Vercel) (`migration/post-launch.csv`), generated 2026-11-09T05:57:03.680Z by `scripts/seo-compare.mjs`.

Rankings cannot be guaranteed. This report checks that the technical signals search engines use were carried over.

## Summary

| Check | Result |
|---|---|
| URLs that still return 200 at the same address | 447 / 459 (97%) |
| URLs that redirect (single hop) | 12 |
| URLs that now return an error | **0** |
| Same title | 447 · changed 0 |
| Meta description kept | 213 · newly added where WordPress had none 234 · changed 0 · **lost 0** |
| Canonical matches the old canonical | 447 · **different 0** |
| Exactly one H1 | 447 · **other 0** |
| Newly noindexed pages | **0** |
| Structured data types preserved | 446 |

## Pages with issues (1)

| URL | Issues |
|---|---|
| /guide-to-setting-up-a-money-lending-business-in-nigeria/ | schema lost: FAQPage |

## Redirected URLs (12)

| Old URL | Redirect |
|---|---|
| /?ensaf_footerbuild=footer-1 | 301 → / |
| /?ensaf_footerbuild=global-footer | 301 → / |
| /?ensaf_header=header-1 | 301 → / |
| /?ensaf_header=header-2 | 301 → / |
| /?ensaf_header=header-3 | 301 → / |
| /cart/ | 301 → /shop/ |
| /checkout/ | 301 → /shop/ |
| /home-full-width/ | 301 → / |
| /my-account-2/ | 301 → /shop/ |
| /practice-areas/ | 301 → /service/ |
| /product-category/books/ | 301 → /shop/ |
| /product-tag/essential-tax-guide/ | 301 → /shop/ |

## Title changes (0)

None.
