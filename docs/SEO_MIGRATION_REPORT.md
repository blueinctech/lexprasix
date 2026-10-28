# SEO migration report

Baseline: WordPress crawl of all 459 sitemap URLs (`migration/baseline/seo-baseline.csv`, 28 Oct 2026).
Compared with: local production-mode build (SITE_ENV=production, next start), 28 Oct 2026 (`migration/new-site-crawl.csv`), generated 2026-10-28T14:02:06.651Z by `scripts/seo-compare.mjs`.

Rankings cannot be guaranteed. This report checks that the technical signals search engines use were carried over.

## Summary

| Check | Result |
|---|---|
| URLs that still return 200 at the same address | 445 / 459 (97%) |
| URLs that redirect (single hop) | 7 |
| URLs that now return an error | **7** |
| Same title | 445 · changed 0 |
| Meta description kept | 212 · newly added where WordPress had none 233 · changed 0 · **lost 0** |
| Canonical matches the old canonical | 445 · **different 0** |
| Exactly one H1 | 445 · **other 0** |
| Newly noindexed pages | **0** |
| Structured data types preserved | 444 |

## Pages with issues (8)

| URL | Issues |
|---|---|
| /cart/ | returns 404 |
| /checkout/ | returns 404 |
| /guide-to-setting-up-a-money-lending-business-in-nigeria/ | schema lost: FAQPage |
| /my-account-2/ | returns 404 |
| /product-category/books/ | returns 404 |
| /product-tag/essential-tax-guide/ | returns 404 |
| /product/essential-tax-guide-for-businesses-in-nigeria-ebook/ | returns 404 |
| /shop/ | returns 404 |

## Redirected URLs (7)

| Old URL | Redirect |
|---|---|
| /?ensaf_footerbuild=footer-1 | 301 → / |
| /?ensaf_footerbuild=global-footer | 301 → / |
| /?ensaf_header=header-1 | 301 → / |
| /?ensaf_header=header-2 | 301 → / |
| /?ensaf_header=header-3 | 301 → / |
| /home-full-width/ | 301 → / |
| /practice-areas/ | 301 → /service/ |

## Title changes (0)

None.
