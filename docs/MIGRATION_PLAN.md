# Migration plan — LexPraxis WordPress → Next.js

The live WordPress site stays untouched and online until the owner approves the cutover. Every step against WordPress is read-only.

## 1. Architecture decisions

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5.9 | Current stable. TypeScript 7 (native compiler) is new and not yet worth the risk for Next's type plugin |
| Styling | Tailwind CSS 4 with a small token-based design system | Fast to build consistent, accessible components |
| Database | **Neon Postgres** (via Vercel Marketplace) | Serverless driver friendly, branch per preview deployment, point-in-time restore |
| ORM / migrations | Drizzle ORM + drizzle-kit SQL migrations in `drizzle/` | Typed queries, plain SQL migrations reviewed in git |
| Auth | Built-in auth adapted from the Goodwillstaffing build: scrypt password hashes, DB-backed sessions (hashed tokens, httpOnly/SameSite=Lax/Secure cookies, idle + absolute expiry), invites, password reset, lockout, revocation | No third-party identity dependency; already hardened and in production elsewhere; no public sign-up. WordPress password hashes are **not** migrated — staff get invite emails |
| Roles | Administrator, Editor, Author | Checked on the server in every action via `requireRole()` |
| Rich text | Tiptap 3 (ProseMirror) storing sanitised HTML; pages use typed blocks | Handles headings, lists, links, tables, quotes, images, embeds; output sanitised on save **and** on render |
| Media storage | **Cloudflare R2** (S3 API): public bucket `lexpraxis-media` behind `media.lexpraxisng.com`; private bucket `lexpraxis-uploads` for client documents | Site is already on Cloudflare, zero egress fees, keeps `/wp-content/uploads/YYYY/MM/file` paths. Code uses the S3 API, so AWS S3 works unchanged |
| Email | **Resend**, sending from `lexpraxisng.com` (SPF/DKIM/DMARC on Cloudflare DNS) | Simple API, good deliverability, React email templates. Provider sits behind an interface so SES can replace it |
| Reliable email | `email_outbox` table; sent immediately after the submission is saved, retried by a Vercel Cron job every 5 minutes with idempotency keys | Serverless functions can be cut off after responding, so nothing important lives only in memory |
| Rate limiting | Postgres fixed-window counters | No extra service needed at this traffic level |
| Caching | Static rendering with `cacheTag` per record; `revalidateTag` on publish; scheduled posts published by cron | Fast pages that update immediately after edits |
| Tests | Vitest (units: validation, permissions, sanitising, redirects) + Playwright (journeys, admin, a11y via axe) | |
| Hosting | Vercel: Preview (per branch, Neon branch DB, `noindex`) and Production | |

## 2. Content model

| Table | Holds | Source |
|---|---|---|
| `users`, `sessions`, `auth_tokens` | Staff accounts | New (invites) |
| `authors` | Public author profiles (name, slug, bio, photo) | WP users with posts (6) |
| `pages` | Core pages with typed blocks, parent, template | WP pages |
| `services` | 13 services: summary, body, FAQs, related, CTA, order | `/service/*` pages |
| `documents` | 23 legal-document/filing pages: intro, what you get, form ID, group (Corporate filings / Agreements) | Form pages |
| `posts` | Articles: HTML, excerpt, featured image, author, dates, status, schedule | WP posts (286) |
| `categories`, `tags`, join tables | Taxonomies with descriptions and SEO | WP terms |
| `comments` | Read-only archive (pending decision) | WP comments (494) |
| `media` | File key, original WP path/ID, mime, size, dimensions, alt, caption | WP media (844) |
| `menus`, `menu_items` | Header, footer, legal-documents mega-menu | Rebuilt from rendered nav (admin export to confirm) |
| `settings` | Contact details, offices, socials, CTAs, tracking IDs, toggles, SEO defaults | Audit |
| `seo` (JSON column on each content table) | Title, description, canonical, robots, OG/Twitter, schema overrides | `yoast_head_json` |
| `redirects` | Source → target, code, hits | `REDIRECT_MAP.csv` + Yoast/Redirection export (needs admin) |
| `legacy_ids` | WP ID → new record/URL | Export |
| `form_submissions`, `submission_files`, `submission_notes` | Enquiries, files (private keys), staff notes, status, assignee | New; optional import of Gravity Forms entries |
| `email_outbox` | Every email with status, attempts, provider ID, last error | New |
| `audit_log` | Who did what, when, from where | New |
| `revisions` | Previous versions of pages/posts/services/documents | New |

## 3. Migration pipeline (repeatable, idempotent)

```
npm run wp:export          # REST → migration/wp-export/*.json (read-only)
npm run migrate:media      # download each media file once → R2 (same path), upsert media rows by wp_id
npm run migrate:content    # transform + upsert pages/services/documents/posts/terms/authors/comments by wp_id
npm run migrate:report     # counts, missing media, broken links → docs/MIGRATION_REPORT.md
```

- **Idempotent:** every row carries `wp_id`; upserts by it. Media keyed by original path; skipped if the object exists with the same size/hash.
- **Retries:** 4 attempts with backoff per HTTP request; failures logged to `migration/logs/*.jsonl`, never silently dropped.
- **Content transforms:** sanitise HTML (allow-list), rewrite `wp-content/uploads` URLs to the media base, strip Elementor wrapper markup, convert Gravity Form/CF7 embeds to form references, convert YouTube iframes to a safe embed, demote in-content `<h1>` to `<h2>`, flag shortcodes for manual review.
- **Elementor pages** (home, about, services): text extracted from rendered HTML into structured fields and reviewed by hand. Layout is redesigned, not copied.
- **Incremental re-run before launch:** the export uses `modified_after` to pick up posts edited in WordPress during the build; a content freeze window (24–48 h) is agreed before cutover.

## 4. Forms

1. Turn each `migration/forms/*.json` into a typed definition in `src/forms/definitions/` (steps, fields, validation, upload rules).
2. Get the Gravity Forms export (admin) to confirm recipients, confirmation text, autoresponders and any admin-only fields; re-create each notification.
3. Confirm what Bit Integrations does with submissions and re-create it.
4. Decide whether to import historic Gravity Forms entries. They are confidential client data: if imported, they go into the protected inbox only, with a retention period agreed with the firm.

## 5. Phases and order of work

| Phase | Deliverable | Depends on |
|---|---|---|
| A. Audit & plan | This folder | — (done, except admin-only items) |
| B. Foundation | Next.js app, design system, DB schema + migrations, auth, roles | Neon database (dev branch) |
| C. Public site | Layout, home, services, documents, blog, archives, contact, booking, legal, 404, feed, sitemap, robots | B |
| D. CMS | Admin dashboard, editors, media library, menus, settings, users, inbox, redirects, audit log | B |
| E. Migration | Media + content import, reconciliation report | R2 bucket; D's schema |
| F. Integrations & SEO | Forms + email outbox, Calendly, Tawk, WhatsApp, GTM/consent, JSON-LD, redirects | Resend domain; GF export |
| G. QA | Unit + E2E tests, axe, Lighthouse, security checks, SEO comparison crawl | C–F |
| H. Preview & launch | Vercel preview review → final incremental import → DNS cutover (owner approval) | All |

## 6. Decisions needed from LexPraxis

1. **Ebook shop:** keep selling (which gateway — Paystack, Flutterwave, Selar?) or retire it? Current price shows as USD 3,000.00.
2. **Comments:** migrate read-only, keep open with moderation, or drop?
3. **Reviews page:** keep the Trustindex embed, or import selected Google reviews?
4. **Homepage figures:** confirm current client/business/country/partner counts and review rating, or remove them.
5. **2022 webinar page:** keep or redirect to `/us-company-registration/`?
6. **Historic form entries:** import into the new inbox, or leave in the WordPress backup?
7. **Brand spelling** in titles: "LexPraxis Solicitors" everywhere?

## 7. Access needed (nothing is blocked yet; these unlock later phases)

| Item | Unlocks | How to provide safely |
|---|---|---|
| WordPress admin user for the migration (Administrator) | Menus, forms export, notifications, SMTP, Bit Integrations, WooCommerce, redirects | Create a separate account for the migration and remove it afterwards; type the password into the browser yourself |
| Neon project (or approval for me to create one through Vercel) | Phase B onwards | Vercel Marketplace integration — credentials land in Vercel env vars, not in chat |
| Cloudflare R2 buckets + API token, or approval to use Vercel Blob instead | Media migration | Vercel env vars |
| Resend account + DNS records added in Cloudflare | Email | I will list the exact records |
| Vercel project linked to `blueinctech/lexprasix` | Previews | Vercel dashboard |
| Search Console + GTM read access | SEO weighting, tracking parity | Add a Google account as a user |

## 8. Rollback

WordPress keeps running on its current host throughout. Cutover is a DNS change in Cloudflare; rollback is reverting that record (minutes, given Cloudflare proxying). Details in `ROLLBACK_PLAN.md` (Phase H).
