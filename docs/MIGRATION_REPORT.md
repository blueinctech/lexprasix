# Migration report

Generated 2026-10-28T14:03:28.082Z by `npm run migrate:report` from the WordPress export of 2026-10-28T11:32:21.342Z (https://lexpraxisng.com) and the current database.

## 1. Record counts

| Type | WordPress | New site | Notes |
|---|---|---|---|
| Posts | 286 | 286 | All migrated |
| Pages (all) | 54 | 12 pages + 13 services + 23 legal documents | 6 intentionally not migrated (see §2) |
| Categories | 25 | 18 | 7 empty categories skipped (already unlisted on the live site) |
| Tags | 123 | 87 | 36 empty tags skipped (already 404 on the live site) |
| Authors | 7 | 6 | Only users with published posts become public authors |
| Comments | 494 | 494 | Read-only archive; commenter emails not imported |
| Media records | 844 | 845 | Files are copied to storage by the media migration step (see §4) |
| Testimonials | 5 (homepage) | 5 |  |
| Legacy IDs (?p=) | — | 340 | Every WordPress post/page ID redirects |
| Redirects | — | 4 | Plus pattern redirects in next.config.ts |
| Menus / settings | — | 4 / 4 | Rebuilt from the live header/footer; confirm against WP menus (needs admin) |

## 2. Records not migrated (intentional)

| Type | URL | Reason |
|---|---|---|
| author | https://lexpraxisng.com/author/blueinchost/ | No published posts (redirected to /blog/) |
| categories | https://lexpraxisng.com/category/advocacy/ | Empty term (already unlisted on the live site) |
| categories | https://lexpraxisng.com/category/copyright/ | Empty term (already unlisted on the live site) |
| categories | https://lexpraxisng.com/category/criminal-law/ | Empty term (already unlisted on the live site) |
| categories | https://lexpraxisng.com/category/family-law/ | Empty term (already unlisted on the live site) |
| categories | https://lexpraxisng.com/category/health-care-policy/ | Empty term (already unlisted on the live site) |
| categories | https://lexpraxisng.com/category/real-estate-law/ | Empty term (already unlisted on the live site) |
| categories | https://lexpraxisng.com/category/technology-law/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/fintech-2/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/how-to-remove-a-trustee-of-an-ngo/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/aml-cft-policy/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/arbitration/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/business/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/business-name-upgrade-cross-river-state-business/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/business-outsourcing/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/civil-law/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/court/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/criminal/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/criminal-law/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/crypto-law/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/defense/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/driver/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/dwi/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/ecowas/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/election/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/family/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/family-law/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/firm/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/health-care/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/how-to-start-a-venture-capital-firm-in-nigeria-examples-of-venture-capital-firms-in-nigeria-what-is-a-venture-capital-firm-investment-securities-and-exchange-commission/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/in-nigeria/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/jury/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/laq/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/law/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/law-nft/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/legal-practice/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/power-of-attorney/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/property/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/real-estate/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/residence-permit/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/technology/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/temporary-work-permit/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/tips/ | Empty term (already unlisted on the live site) |
| tags | https://lexpraxisng.com/tag/trial/ | Empty term (already unlisted on the live site) |
| page | https://lexpraxisng.com/checkout/ | WooCommerce: awaiting decision on the ebook shop |
| page | https://lexpraxisng.com/cart/ | WooCommerce: awaiting decision on the ebook shop |
| page | https://lexpraxisng.com/shop/ | WooCommerce: awaiting decision on the ebook shop |
| page | https://lexpraxisng.com/my-account-2/ | WooCommerce: awaiting decision on the ebook shop |
| page | https://lexpraxisng.com/home-full-width/ | 2017 theme demo with raw shortcodes; 301 to / |
| page | https://lexpraxisng.com/practice-areas/ | 2016 page with raw shortcodes; 301 to /service/ |

## 3. Needs manual review

| Type | URL | Reason |
|---|---|---|
| post | https://lexpraxisng.com/how-to-amend-the-memorandum-and-articles-of-association/ | Contains a WordPress shortcode that does not render outside WordPress |
| post | https://lexpraxisng.com/tax-obligations-for-foreign-investors-in-nigeria/ | Contains a WordPress shortcode that does not render outside WordPress |
| post | https://lexpraxisng.com/what-to-do-when-your-intellectual-property-right-is-breached/ | Contains a WordPress shortcode that does not render outside WordPress |
| post | https://lexpraxisng.com/how-to-launch-a-bureau-de-change-in-nigeria/ | Contains a WordPress shortcode that does not render outside WordPress |

## 4. Media

- Media library items: 845. Inline images checked in migrated content: 48 (1 hosted on third-party sites, left as-is).
- Image references in content that are **not in the WordPress media library**: 15 (4 distinct files). Of these, 15 already return 404 on the live WordPress site, so nothing was lost in migration.
  - /doing-business-in-the-us-accessing-international-funding-oppurtunities-webinar-invitation/ → `/wp-content/uploads/2022/07/LEX-PRAXIS-E-FLYER-150x150.jpg` (live site: 404)
  - /doing-business-in-the-us-accessing-international-funding-oppurtunities-webinar-invitation/ → `/wp-content/uploads/2022/07/MEET-OUR-SPEAKER-JASON-D.-CRAIN-150x150.jpg` (live site: 404)
  - /doing-business-in-the-us-accessing-international-funding-oppurtunities-webinar-invitation/ → `/wp-content/uploads/2022/07/MEET-OUR-SPEAKER-LINDSEY-S.-MIGNANO-150x150.jpg` (live site: 404)
  - /how-to-start-your-business-in-the-us-as-a-foreigner/ → `/wp-content/uploads/2022/10/download-1-150x150.png` (live site: 404)
- Already broken on the live site before migration (404 on lexpraxisng.com): 3
  - `/wp-content/uploads/2022/07/LEX-PRAXIS-E-FLYER-150x150.jpg`
  - `/wp-content/uploads/2022/07/MEET-OUR-SPEAKER-JASON-D.-CRAIN-150x150.jpg`
  - `/wp-content/uploads/2022/07/MEET-OUR-SPEAKER-LINDSEY-S.-MIGNANO-150x150.jpg`
- **File copy status:** media files are still served from the WordPress host in development. Copy them to the production bucket with the media migration step before launch; until then this section cannot report storage coverage.

## 5. Internal links in migrated content

Checked 223 internal links across 311 posts, services and pages. Broken: **6**.

| Page | Link | Problem |
|---|---|---|
| /what-is-firs-tax-pro-max/ | `/product/essential-tax-guide-for-businesses-in-nigeria-ebook/` | No page or redirect at this path |
| /withholding-tax-in-nigeria/ | `/product/essential-tax-guide-for-businesses-in-nigeria-ebook/` | No page or redirect at this path |
| /do-ngos-pay-taxes-in-nigeria/ | `/product/essential-tax-guide-for-businesses-in-nigeria-ebook/` | No page or redirect at this path |
| /do-ngos-pay-taxes-in-nigeria/ | `/product/essential-tax-guide-for-businesses-in-nigeria-ebook/` | No page or redirect at this path |
| /how-to-get-your-tax-clearance-certificate-in-nigeria/ | `/product/essential-tax-guide-for-businesses-in-nigeria-ebook/` | No page or redirect at this path |
| /how-to-start-a-business-in-nigeria-as-a-foreigner/ | `/product/essential-tax-guide-for-businesses-in-nigeria-ebook/` | No page or redirect at this path |

## 6. URL differences

All posts, legal-document pages, services, categories, tags and author archives keep their WordPress URLs. Changed URLs are listed in [REDIRECT_MAP.csv](REDIRECT_MAP.csv).

## 7. Metadata

Yoast titles, descriptions, canonicals (when not self-referencing), robots directives and OG overrides are stored per record in the `seo` column, with the original Yoast values kept under `seo.legacy` for comparison. See [SEO_MIGRATION_REPORT.md](SEO_MIGRATION_REPORT.md) for the crawl comparison.
