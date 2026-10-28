# Feature inventory

Every user-facing and back-office feature found on the current site, and how the rebuild handles it. Status key: **Keep** (rebuild with same behaviour), **Improve**, **Replace**, **Decision** (owner input needed), **Blocked** (needs access).

## Public site

| # | Feature | Current implementation | Rebuild | Status |
|---|---|---|---|---|
| 1 | Header with mega-menu of legal documents | Ensaf header + Elementor | Accessible header, CMS-managed menus, mobile drawer | Improve |
| 2 | "Free consultation" CTA in header | Link to `/contact-us/` | CTA label/target in site settings (default: `/book-appointment/`) | Improve |
| 3 | Homepage | Elementor | New design; sections fed by CMS (services, posts, reviews, steps) | Improve |
| 4 | Services index and 13 service pages | Elementor template-builder | `services` content type; FAQs, related services, CTA | Keep URLs / Improve |
| 5 | 23 legal-document intake pages | Elementor + Gravity Forms | `documents` content type + linked form definition; multi-step form | Keep URLs / Improve |
| 6 | Legal Forms and Corporate Filings index pages | Elementor list / empty page | Generated listings grouped by category | Improve |
| 7 | Blog index with pagination | WordPress | `/blog/`, `/blog/page/N/` | Keep |
| 8 | Blog post | Theme single | New reading template: TOC, author, dates, categories, tags, related posts, share, enquiry CTA | Improve |
| 9 | Category, tag and author archives | WordPress | Same URLs, paginated | Keep |
| 10 | Date archives `/YYYY/MM/DD/` | WordPress | 301 to `/blog/` (thin, not in sitemap) | Replace |
| 11 | Comments (494 on 64 posts) | WordPress comments | **Decision**: (a) migrate as read-only, (b) migrate + moderated new comments, (c) drop. Default: migrate read-only, comments closed | Decision |
| 12 | Contact page with 3 offices, map | Elementor + CF7 + Google Maps iframe | Contact form, office cards from settings, lazy map | Keep |
| 13 | Book appointment | Calendly inline embed | Calendly inline embed (consent-aware), fallback link | Keep |
| 14 | Reviews page | Trustindex widget | Decision (see plugin audit) | Decision |
| 15 | Privacy policy, terms | Pages | CMS pages; privacy policy needs updating for new processors | Keep |
| 16 | Webinar landing page (2022) | Elementor canvas | Generic CMS page; owner to confirm keep/redirect | Decision |
| 17 | Ebook shop (1 product) | WooCommerce | Decision (see plugin audit) | Decision |
| 18 | Live chat | Tawk.to | Same, deferred load, toggle in settings | Keep |
| 19 | WhatsApp button | Elementor floating button | Built-in, number in settings | Keep |
| 20 | RSS feed | `/feed/` | `/feed/` route | Keep |
| 21 | Search | None visible on the public site (WP `?s=` works) | Blog search on `/blog/?q=` (Postgres full-text) | Improve |
| 22 | 404 page | Theme | Branded 404 with search and popular links, real 404 status | Improve |
| 23 | Cookie consent | **None detected** while GA4/Ads/Tawk load | Lightweight consent banner (Google Consent Mode v2) — recommended for NDPA 2023 | Improve |

## Forms

| Form | Fields (excluding headings) | Required | Uploads | Steps | Destination |
|---|---|---|---|---|---|
| Contact (CF7 930) | 4 | 4 | 0 | 1 | `contact` form |
| Company Registration (GF 8) | ~124 | 37 | 1 | 5 | `company-registration` |
| Copyright Registration (GF 14) | ~124 | 114 | 1 | multi | `copyright-registration` |
| Incorporated Trustees (GF 25) | 70 | 32 | 2 | multi | |
| T.C.C Form (GF 1) | 52 | 41 | 4 | multi | |
| Business Name Registration (GF 16) | 47 | 0 ⚠ | 2 | multi | Required flags look missing on the live form; confirm |
| Deed of Assignment (GF 13) | 42 | 21 | 4 | multi | |
| Lease Agreement (GF 17) | 40 | 18 | 4 | multi | |
| Employment Contract (GF 11) | 36 | 6 | 2 | multi | |
| Non-Disclosure Agreements (GF 10) | 35 | 29 | 2 | multi | |
| US Company Registration (GF 24) | 32 | 18 | 2 | 1 | |
| Tenancy Agreement (GF 23) | 31 | 21 | 0 | multi | |
| Partnership Agreement (GF 4) | 29 | 26 | 0 | multi | |
| Independent Contractors Agreement (GF 20) | 28 | 20 | 0 | multi | |
| Loan Agreement (GF 6) | 28 | 20 | 0 | multi | |
| Trademark Assignment (GF 18) | 27 | 18 | 0 | multi | |
| Trademark Registration (GF 15) | 18 | 14 | 3 | multi | |
| Letter of Confirmation (GF 22) | 18 | 14 | 0 | multi | |
| Resolution of Board of Directors (GF 21) | 18 | 13 | 0 | multi | |
| Notice of Rent Increase (GF 5) | 18 | 15 | 0 | multi | |
| Power of Attorney (GF 3) | 16 | 11 | 0 | multi | |
| Hire Purchase Agreement (GF 12) | 13 | 12 | 0 | multi | |
| Company Seal (GF 7) | 8 | 5 | 0 | multi | |
| Company Stamp (GF 19) | 8 | 3 | 0 | multi | |

Field-level definitions: `migration/forms/gf-*.json`, `cf7-930.json`. Counts are from rendered HTML; the Gravity Forms export (needs admin) is the source of truth for notifications, confirmations and hidden/admin-only fields.

### Required behaviour for every form (rebuild)

Server-side Zod validation · accessible labels and inline errors · values kept after a failed submit · step-by-step progress with per-step validation · save to Postgres before anything else · honeypot + minimum fill time + per-IP rate limit · origin check (Server Actions) · uploads to **private** storage with type/size limits and signed download links for staff · staff notification and client confirmation via an email outbox with retry · GTM `form_submit` event on success · confirmation screen with next steps.

## Back office

| # | Feature | Current | Rebuild |
|---|---|---|---|
| A | Login | wp-login | `/admin/login`, scrypt-hashed passwords, lockout, sessions in DB |
| B | Roles | WP roles | Administrator, Editor, Author — enforced on every server action |
| C | Pages | Elementor | Block editor (rich text, hero, CTA, FAQ, steps, cards, embed) with draft/preview/schedule |
| D | Posts | WP editor | Tiptap rich-text editor, categories, tags, author, featured image, SEO, schedule, preview |
| E | Services / documents | Elementor pages | Structured editors |
| F | Media library | WP media | Upload to object storage, alt/caption, usage tracking, replace, search |
| G | Menus | WP menus | Drag-to-reorder menu editor |
| H | Site settings | Theme options | Contact details, offices, social, CTAs, tracking IDs, chat/WhatsApp toggles, SEO defaults |
| I | Form entries | Gravity Forms entries | Enquiry inbox: filter, status, assignee, notes, file download, CSV export, retention purge |
| J | Redirects | Yoast / server | Redirect manager table (checked in the proxy) |
| K | Activity log | Simple History | `audit_log` for every sensitive action |
| L | Users | WP users | Invite by email, role change, deactivate, revoke sessions |
| M | Email log | WP Mail SMTP (if Pro) | Outbox status per message with retry |
