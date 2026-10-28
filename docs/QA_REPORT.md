# QA report

**Date:** 28 October 2026 · **Build:** local production build (`SITE_ENV=production next build && next start`) against PostgreSQL 18 with the full WordPress import. **Not yet tested on Vercel/Neon/R2/Resend** — those accounts don't exist yet (see "Blockers").

## 1. Summary

| Area | Result |
|---|---|
| Unit + integration tests (`npm test`) | **91 / 91 pass** (real database for integration) |
| End-to-end tests (`npm run test:e2e`, Edge, desktop + mobile) | **29 / 29 pass** |
| SEO comparison with WordPress (459 URLs) | 445 identical URLs return 200; 7 single-hop 301s; 7 WooCommerce URLs 404 pending the shop decision. 0 titles changed, 0 descriptions lost (233 added), 0 canonical differences, 0 H1 problems, 0 newly noindexed |
| Lighthouse (mobile) | Home 98/100/100/100 · Service 100/100/100/100 · Article 90/100/96/100 · Legal document 91/100/100/100 (performance / accessibility / best practices / SEO) |
| axe (WCAG 2.2 AA) on 15 templates | 0 serious or critical violations |
| TypeScript / ESLint | Clean |
| Production dependencies (`npm audit --omit=dev`) | 0 vulnerabilities |

## 2. Tests executed

### Unit (`tests/unit`)
Form definitions (all 25 forms: unique ids, email field, valid choices), field validation (required, email, phone, choices, uploads, length caps), sanitiser (script/handler/`javascript:` removal, allowed embeds, H1 demotion, noopener), password hashing and policy, role permissions matrix, open-redirect and storage-key traversal guards, filename normalisation, SEO metadata/Yoast title pattern/canonicals, JSON-LD breadcrumbs, page-block validation (rejects unknown types and non-https / non-allow-listed embeds), proxy 404 decisions for every route family.

### Integration (`tests/integration`, real PostgreSQL)
Contact submission stored + staff and client emails queued and sent through the outbox · idempotent resubmission · invalid input rejected with field errors and nothing stored · honeypot and too-fast submissions stored as spam and not emailed · rate limit after 8 submissions per connection · newsletter requires and stores consent · uploads only signed for real file fields/allowed types/size · a file whose bytes don't match its extension is rejected, a real PDF is accepted and claimed · sign-in success creates a session · identical message for unknown email and wrong password · lockout after 5 failures · deactivated users can't sign in · invite token works once · reset token can't be used as an invite · password reset revokes other sessions.

### End-to-end (`tests/e2e`, Edge)
15 templates render with exactly one H1, correct canonical, JSON-LD and no serious axe violations · unknown URLs return 404 · 8 legacy URL patterns redirect in one hop · sitemap (>400 URLs, no admin/theme URLs), RSS and production robots.txt · security headers · mega-menu navigation · multi-step form validation · contact form end-to-end with reference number · mobile menu and no horizontal scroll · anonymous users redirected from admin, admin noindex · forged session rejected on private routes · generic wrong-password message · administrator sign-in/enquiries/sign-out · editor blocked from users/settings/activity and CSV export (403) · author blocked from enquiries.

### Manual browser checks (in-app browser, dev and production builds)
Homepage, service, article, contact, legal-document form, admin dashboard, enquiry detail (status, assignment, internal note), article edit → change visible on the public page immediately, media upload (signed upload, signature check, dimensions recorded), all 14 admin sections load. Screenshots: `docs/qa-screenshots/`.

## 3. Defects found during QA and fixed

| # | Defect | Fix |
|---|---|---|
| 1 | Admin forms: after a save, React's automatic form reset put the status dropdown back to "Draft" while still showing "Published" — the next save unpublished a live article | Admin forms now submit without the automatic reset; the server also keeps the current status if none is sent |
| 2 | Admin pages didn't show saved changes until reload | Successful admin actions refresh the page |
| 3 | Missing pages returned **200** (+noindex) on first request (streamed shell) | The proxy recognises missing content URLs and returns a real 404 |
| 4 | Admin-managed redirects issued from a page had no `Location` header; redirects added after a build were ignored | Redirects moved to the proxy (cached 60 s, single hop, hit counting) |
| 5 | Admin UI helpers were client-only but called from server pages (runtime error) | UI kit split into server-safe and client modules |
| 6 | Embed block accepted `javascript:` URLs | https only, allow-listed hosts |
| 7 | Title suffix lost its space ("Archives- Lexpraxis"); author archive titles differed from Yoast | Suffix no longer trimmed; author titles follow Yoast's pattern |
| 8 | "Yes I understand" acknowledgement in the Power of Attorney form had no options | Converted to a consent checkbox |
| 9 | Low-contrast numbers on service cards (axe) | Darkened |
| 10 | Header CTA wrapped on phones (`hidden` overridden by `inline-flex`) | Breakpoint moved to a wrapper |
| 11 | Public form action could fail silently on server misconfiguration | Returns a clear message with contact alternatives |
| 12 | `/appointment-booking/` (linked from two old posts) was already a dead link | Redirect to `/book-appointment/` |

## 4. Known issues and limitations

| Item | Impact | Next step |
|---|---|---|
| Ebook shop (`/shop/`, `/product/…`, cart, checkout, account, 2 product archives) not rebuilt | 7 URLs 404; 6 articles link to the ebook | **Owner decision** (see MIGRATION_PLAN §6). Either rebuild with a hosted checkout or add redirects |
| One article lost Yoast's FAQ rich-result markup (`/guide-to-setting-up-a-money-lending-business-in-nigeria/`) | Minor; content is intact | Re-add as FAQ data if the firm wants the rich result |
| 4 WordPress posts contain shortcodes that don't render outside WordPress | Text like `[shortcode]` visible | Edit in the admin (listed in MIGRATION_REPORT §3) |
| Article LCP 3.5 s locally | Featured images are still served from the WordPress host in this test | Resolves once media is in R2 behind a CDN; re-measure on Vercel |
| Page hierarchy (nested page URLs) not supported | None today — WordPress had no nested pages except services | — |
| Deleting a live page/post doesn't add a redirect automatically | Possible 404 if staff delete instead of unpublish | Admin guide tells staff to add a redirect; could be automated |
| In-app browser pane didn't paint streamed admin pages in the background | Test-environment only; Playwright confirms admin pages render | — |

## 5. Security review (summary)

- Passwords: scrypt; 12+ characters; lockout; timing-safe; no WordPress hashes imported.
- Sessions: random 256-bit tokens, only hashes stored, HttpOnly + Secure + SameSite=Lax, path `/admin`, 12 h absolute / 2 h idle, revoked on reset/role change/deactivation.
- Authorisation enforced server-side in every admin page, action and route (`requireUser*` with a permission matrix); E2E confirms direct requests are refused.
- Client enquiries: never in public queries; private bucket; 5-minute signed download links; every view/download/export/delete is in the activity log; CSV export is formula-injection safe.
- Input: Zod everywhere; rich text sanitised on save and render; uploads checked by size, extension and file signature; SVG uploads refused.
- Abuse: honeypot, minimum fill time, Postgres rate limits on forms, uploads, sign-in and resets.
- Headers: CSP (no `unsafe-eval` in production), HSTS, nosniff, Referrer-Policy, X-Frame-Options/frame-ancestors, Permissions-Policy; admin and previews `noindex`.
- Secrets only in environment variables; `.env*` ignored by git; no `NEXT_PUBLIC_` secrets.
- **Open items:** CSP still allows `'unsafe-inline'` scripts (needed for Next.js without per-request nonces, which would make every page dynamic); backup restore drill must be done on Neon (DEPLOYMENT §7); dev-only dependency advisories exist in tooling (not shipped).

## 6. Blockers (need access or decisions)

1. WordPress admin access — form notification recipients, SMTP sender, Bit Integrations flows, menus, Yoast redirects, WooCommerce settings/orders.
2. Neon, Cloudflare R2, Resend and a Vercel project — to deploy a preview and run this suite against it.
3. Decisions listed in MIGRATION_PLAN §6 (shop, comments, reviews widget, homepage figures, webinar page, historic entries).
4. Search Console and GTM access — traffic-weighted SEO checks and tracking parity.
