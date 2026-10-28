# Acceptance criteria

Launch requires every **Must** item verified, with evidence recorded in `QA_REPORT.md`. "Verified" means tested on the preview deployment, not just "the build passed".

## Design and public site

| ID | Criterion | Level | How verified |
|---|---|---|---|
| D1 | Every page type in `PAGE_INVENTORY.csv` with action `keep` renders on the new site | Must | Comparison crawl: 200 for every kept URL |
| D2 | Layouts work at 360, 768, 1024, 1440 px with no horizontal scroll | Must | Playwright screenshots per template |
| D3 | Header, mega-menu, mobile menu and footer links all resolve | Must | Link checker: 0 internal 404s |
| D4 | Primary CTAs (consultation, book, document intake) reach a working destination | Must | E2E |
| D5 | No unverified figures, ratings, awards or reviews are displayed | Must | Content review sign-off |
| D6 | WCAG 2.2 AA: keyboard navigation, visible focus, contrast, labelled forms; 0 serious/critical axe violations on each template | Must | axe in Playwright |
| D7 | Respects `prefers-reduced-motion` | Must | Manual + E2E emulation |
| D8 | Lighthouse (mobile) on home, a service, a post, a document page: Performance ≥ 90, Accessibility ≥ 95, SEO = 100, Best Practices ≥ 95 | Should | Lighthouse runs, recorded |

## CMS and admin

| ID | Criterion | Level |
|---|---|---|
| C1 | Staff can log in, log out, reset a password; sessions expire; locked after repeated failures | Must |
| C2 | No public sign-up; accounts created by invite only | Must |
| C3 | Administrator / Editor / Author permissions enforced on the server — direct calls to actions return 403 for the wrong role | Must |
| C4 | Pages, posts, services, documents: create, edit, draft, preview, publish, unpublish, schedule, revisions | Must |
| C5 | Publishing updates the public page within seconds (no redeploy) | Must |
| C6 | SEO fields editable per record (title, description, canonical, robots, OG image) | Must |
| C7 | Media upload to durable storage with alt text, captions, type/size limits; files survive redeploys | Must |
| C8 | Menus and site settings editable; no business details hardcoded in components | Must |
| C9 | Enquiry inbox: list, filter, view, status, assignee, notes, secure file download, CSV export | Must |
| C10 | Audit log records logins, role changes, publishes, deletions, submission access/exports | Must |
| C11 | Redirect manager: add/edit/delete with loop and chain prevention | Should |
| C12 | Dashboard numbers come from live database queries | Must |

## Migration

| ID | Criterion | Level |
|---|---|---|
| M1 | Destination counts match source for posts (286), service pages (13), document pages (22), core pages, categories (18 used), tags (87 used), authors (6), media in use | Must |
| M2 | Every migrated image and file loads from the new storage (0 references to the old server's uploads in content) | Must |
| M3 | Per-post spot check of 20 random posts: title, body, headings, tables, images, dates, author, categories, tags match | Must |
| M4 | Every intentional omission is listed with a reason in `MIGRATION_REPORT.md` | Must |
| M5 | Migration scripts can be rerun without creating duplicates | Must |

## Business operations

| ID | Criterion | Level |
|---|---|---|
| B1 | Contact form and all 22 intake forms validate on the server, store the submission, and show a confirmation | Must |
| B2 | Uploaded client documents go to private storage and are only reachable through signed links from the admin | Must |
| B3 | Staff notification and client confirmation emails are delivered from the verified domain (checked in a real inbox) | Must |
| B4 | Email failures show in the admin with status and retry; no duplicate sends on retry | Must |
| B5 | Spam controls: honeypot, timing, rate limit verified | Must |
| B6 | Calendly booking works from `/book-appointment/` and the homepage | Must |
| B7 | Behaviour of Bit Integrations flows (if any) is re-created | Must (if found) |
| B8 | Ebook purchase works end-to-end, or the shop is retired with redirects (per owner decision) | Must |

## SEO

| ID | Criterion | Level |
|---|---|---|
| S1 | Every indexable baseline URL returns 200 at the same path, or a single-hop 301 listed in `REDIRECT_MAP.csv` | Must |
| S2 | Titles, descriptions, canonicals, robots match the baseline (or are deliberate improvements, listed) | Must |
| S3 | `sitemap.xml` contains every published indexable URL and nothing else; `robots.txt` allows crawling on production | Must |
| S4 | JSON-LD validates (Schema.org validator) and matches page content; no AggregateRating without a verifiable source | Must |
| S5 | One H1 per page | Must |
| S6 | Preview deployments are `noindex`; production is not | Must |
| S7 | GTM/GA4/Ads fire once per page view and once per conversion | Must |
| S8 | Unknown URLs return a real 404 status | Must |

## Security and privacy

| ID | Criterion | Level |
|---|---|---|
| X1 | Anonymous users cannot reach `/admin/*` pages or actions | Must |
| X2 | Submissions are never returned by public routes | Must |
| X3 | Rich text is sanitised; stored XSS payloads do not execute | Must |
| X4 | No secrets in the client bundle (`NEXT_PUBLIC_` audit + bundle grep) | Must |
| X5 | Security headers: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors | Must |
| X6 | `npm audit` shows no high/critical issues in production dependencies | Must |
| X7 | Database backup/restore tested once on a Neon branch | Must |
| X8 | Retention policy for enquiries agreed and implemented (purge job) | Should |
| X9 | Cookie consent with Google Consent Mode before non-essential tags load | Should |

## Production

| ID | Criterion | Level |
|---|---|---|
| P1 | Production build succeeds on Vercel; migrations applied | Must |
| P2 | Env vars configured in Vercel (none in git) | Must |
| P3 | Rollback plan rehearsed (DNS revert documented and timed) | Must |
| P4 | Owner approval recorded before DNS change | Must |
| P5 | Post-launch smoke test and SEO re-crawl recorded | Must |
