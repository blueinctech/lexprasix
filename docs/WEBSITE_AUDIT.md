# LexPraxis website audit

**Site:** https://lexpraxisng.com/ · **Audited:** 28 October 2026 · **Method:** public crawl, Yoast sitemaps, unauthenticated WordPress REST API, rendered HTML inspection.

**WordPress admin access: not yet provided.** Everything below comes from public sources. Items marked **(needs admin)** cannot be verified until access is available.

Raw evidence (regenerate with the scripts in `scripts/`):

| File | Source |
|---|---|
| `migration/wp-export/*.json` | `npm run wp:export` (REST API, read-only, git-ignored) |
| `migration/baseline/sitemap-urls.txt` | All 459 URLs in the Yoast sitemap index |
| `migration/baseline/seo-baseline.csv` | `scripts/seo-crawl.mjs`, one row per URL |
| `migration/forms/*.json` | `scripts/extract-forms.mjs`, field definitions for every form |
| `docs/PAGE_INVENTORY.csv` | `scripts/build-inventory.mjs`, 501 URLs with destinations |

## 1. Platform

| Item | Finding |
|---|---|
| CMS | WordPress, behind Cloudflare (proxy, email obfuscation) |
| Theme | "Ensaf" (has its own header/footer builder post types `ensaf_header`, `ensaf_footerbuild`) |
| Page builder | Elementor (+ Elementor AI, Elementor One, Essential Addons). Two 2016–17 pages still contain raw WPBakery shortcodes from an older theme |
| Blog content | Gutenberg/classic HTML (94 posts use block markup; 12 contain tables; 3 contain shortcodes) |
| Front page | Page 42 (`/`); posts page is page 3987 (`/blog/`) |
| Timezone | GMT+1 (Africa/Lagos) |
| Site tagline | "Business Law firm in Nigeria for Entreprenuers and Corporate Businesses" (typo "Entreprenuers" is live) |

## 2. Plugins detected from public REST namespaces

See `WORDPRESS_PLUGIN_AUDIT.md` for the replacement plan. Detected: Yoast SEO, Contact Form 7, Gravity Forms (+ Essential Addons GF widget), Akismet, LiteSpeed Cache, Simple History, WooCommerce (+ Brands, POS, Admin, Analytics), Elementor (+ AI, One, MCP Composer), Jetpack, WP Mail SMTP, Bit Integrations, Google Site Kit, WP Abilities/MCP, Trustindex (reviews widget), Calendly embed, Tawk.to chat.

## 3. Content volumes

| Type | Count | Notes |
|---|---|---|
| Pages | 54 published | 13 services, 23 legal-document intake pages, 4 WooCommerce, 2 legacy, rest core pages |
| Posts | 286 published | All at root `/{slug}/`. 2019–2026; ~1 per week since 2022. 281 have featured images |
| Categories | 25 (18 with posts) | `blog` holds 278 posts; others are topical |
| Tags | 123 (87 with posts) | Empty tags already 404 |
| Authors | 7 (6 with posts) | Cynthia Tishion wrote 262 of 286 posts |
| Media | 844 files, ~264 MB | 446 PNG, 320 JPEG, 70 SVG, 3 ZIP, 1 PPTX, 2 video, 1 audio, 1 TXT. 197 have alt text |
| Comments | 494 public | On 64 posts. All type `comment` |
| Products | 1 (WooCommerce) | "Essential Tax Guide For Businesses in Nigeria (eBook)" |
| Forms | 23 | 23 Gravity Forms + 1 Contact Form 7 |

## 4. Page types found

| Type | URLs | Example |
|---|---|---|
| Homepage | 1 | `/` |
| About | 1 | `/about-us/` |
| Services index + 13 service details | 14 | `/service/`, `/service/company-formation-and-restructuring/` |
| Legal document / filing intake (form pages) | 23 | `/company-registration/`, `/non-disclosure-agreements/` |
| Document index pages | 2 | `/legal-forms/`, `/corporate-filings/` (empty page, used as a menu parent) |
| Booking | 1 | `/book-appointment/` (Calendly) |
| Contact | 1 | `/contact-us/` (CF7 + three offices) |
| Reviews | 1 | `/review/` (Trustindex widget only) |
| Legal | 2 | `/privacy-policy/`, `/terms-and-condition/` |
| Event landing page | 1 | `/how-to-start-your-business-in-the-us-as-a-foreigner/` (2022 webinar, Elementor canvas) |
| Blog index, posts, category, tag, author archives | 1 + 286 + 18 + 87 + 6 | `/blog/`, `/category/business-law/`, `/tag/…/`, `/author/janet-okochi/` |
| WooCommerce | 5 | `/shop/`, `/cart/`, `/checkout/`, `/my-account-2/`, `/product/essential-tax-guide-…/` |
| Legacy / artefacts | 7 | `/home-full-width/`, `/practice-areas/` (raw shortcodes visible), 5 `/?ensaf_header=…` / `/?ensaf_footerbuild=…` theme templates exposed in the sitemap |

Full list with titles, SEO fields and destinations: `PAGE_INVENTORY.csv`.

## 5. Navigation (from rendered header/footer)

- **Header:** Home · Legal Documents (→ Corporate Filings group: Incorporated Trustees, US Company Registration, Company Seal, Company Registration, Copyright Registration, Tax Clearance Certificate, Trademark Registration, Company Stamps, Resolution of Board of Directors, Business Name Registration; agreements group: Employment Contract, Notice of Rent Increase, Deed of Assignment, Power of Attorney, Loan Agreement, Partnership Agreement, NDA, Hire Purchase, Independent Contractors, Letter of Confirmation, Tenancy, Trademark Assignment, Lease) · About Us · Services · Blog · Contact · **Free consultation** CTA.
- **Footer:** Service, Legal Forms, Book Appointment, Privacy Policy, Terms and Condition, Our Shop; three featured services; office addresses; phones; email; social links; "Copyright 2025".
- Exact menu structure and menu locations are **(needs admin)**: `/wp/v2/menus` is not public.

## 6. Business information shown on the site

| Item | Value (as published) |
|---|---|
| Name | LexPraxis Solicitors (also "Lex-Praxis Solicitors", "Lexpraxis Solicitors") |
| Email | info@lexpraxisng.com |
| Phones | +234 916 054 6551, +234 706 544 3425 |
| Lagos | 23 Water Corporation Drive, Victoria Island, Lagos |
| Abuja | 22 Kumasi Crescent, Wuse 2, Abuja |
| Calabar | 66 Ndidem Usang Iso Road, Calabar |
| Social | Instagram `lex_praxis_businesslawyers`, LinkedIn `lex-praxis-business-lawyers`, YouTube `@lex-praxis` |
| WhatsApp | Floating button on every page (number in widget) |
| Brand colours | Navy `#20336D` / `#112347`, gold `#AE844E` (Calendly uses `#BE8F4F`) |
| Fonts | Playfair Display, Poppins, Inter, Lora, Cardo (mixed) |
| Logos | `/wp-content/uploads/2026/01/logo-icon.png`, `/2025/02/round-logo.svg`, `/2024/12/roundlogo.png` |

### Trust claims that need confirmation before reuse

The homepage states: "Join 2k+ Satisfied Clients", "4.9/5 (348+ Reviews)", "250+ Businesses", "10+ Countries", "180+ Happy Clients", "20+ Partners". These cannot be verified publicly, and "2k+ satisfied clients" contradicts "180+ happy clients". **The rebuild will not display them until the firm confirms current figures**, and review ratings will only be shown if they come from a verifiable source (e.g. the Google Business Profile behind the Trustindex widget).

## 7. Forms and workflows

| Form | Engine | Where | Notes |
|---|---|---|---|
| Contact | CF7 #930 | `/contact-us/` | Name, email, phone (number field), message; Akismet honeypot |
| 23 legal-document / filing intake forms | Gravity Forms #1, 3–8, 10–25 | One per document page | Mostly multi-page (5 sections typical). 8 to 147 fields. 27 file-upload fields across them. No payment/product fields. No conditional logic in the rendered output |
| Booking | Calendly | `/book-appointment/`, homepage | `calendly.com/lexpraxisng-info/30min` (30-minute call) |
| Live chat | Tawk.to | All pages | Property `69a7f54bd9992f1c3736409c` |
| Ebook purchase | WooCommerce | `/shop/`, `/product/…` | Gateway, price and delivery method **(needs admin)**. Store API reports `USD 3,000.00`, which is probably a currency misconfiguration |

**(needs admin):** form notification recipients, confirmation messages, autoresponders, stored entries, WP Mail SMTP provider/sender, Bit Integrations flows (may push submissions to a CRM/Sheets), Gravity Forms add-ons (reCAPTCHA is referenced in markup).

## 8. Tracking

| Tag | ID |
|---|---|
| Google Tag Manager | `GTM-WXSMSFBP` |
| GA4 | `G-F2X69KFLWM` |
| Google Ads | `AW-17108190829` |
| Site Kit Google tag | `GT-KDZB6W45` |
| Tawk.to | see above |

GTM container contents and conversion events **(needs GTM access)**. Risk: GA4 is loaded both directly and (likely) through GTM, so events may already be double-counted; to be checked in GTM.

## 9. URL and server behaviour

| Request | Result |
|---|---|
| `http://` | 301 → `https://` |
| `www.` | 301 → apex |
| No trailing slash | 301 → trailing slash |
| Uppercase path (`/About-Us/`) | 200 (no normalisation; duplicate URL) |
| `/?p=ID` | 301 → permalink |
| Date archives `/2026/10/22/` | 200 |
| `/feed/` | 200 (RSS) |
| `/blog/page/2/` | 200 |
| Unknown path | 404 |
| `/checkout/` | 302 → `/cart/` |

`robots.txt` is WooCommerce + Yoast defaults, with the sitemap URL on `http://` (minor issue).

## 10. SEO summary

See `SEO_BASELINE.md`. 458/459 sitemap URLs return 200; Yoast emits Article/WebPage/BreadcrumbList/Organization/Person JSON-LD everywhere; 246 URLs have no meta description; 268 of 3,490 images on crawled pages lack alt text; 5 theme-template URLs are wrongly in the sitemap.

## 11. Issues found on the current site

1. Legacy pages `/home-full-width/` and `/practice-areas/` are published and indexable, showing raw `[vc_row …]` shortcode text.
2. Theme header/footer templates (`/?ensaf_header=…`) are listed in the sitemap.
3. Inconsistent client-count claims on the homepage.
4. `/about-us/` shows leftover theme demo text ("Ensaf The Best Service Provider").
5. Footer says "Copyright 2025".
6. Mixed font families (five typefaces) and inconsistent brand spelling.
7. 844 media files but only 197 have alt text.
8. 5 images referenced in content are not in the Media Library (uploaded outside it or deleted).
9. Uppercase URLs are not normalised.

## 12. What still needs access

| Access | Why |
|---|---|
| WordPress admin (Administrator role) | Menus, form notifications/recipients, stored entries, SMTP, Bit Integrations, redirects (Yoast Premium / Redirection), WooCommerce settings and orders, user roles, Tawk/WhatsApp settings, drafts and private content |
| Gravity Forms export (Forms → Import/Export) | Exact form JSON incl. notifications and confirmations |
| Google Tag Manager, GA4, Search Console | Conversion setup, top landing pages, backlink targets |
| Calendly account owner | Confirm event type and notification routing (no change expected) |
| Trustindex / Google Business Profile | Source of review data |
| DNS (Cloudflare) | Email domain verification and the final cutover |
