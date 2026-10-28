# Launch and rollback plan

The switch from WordPress to the new site is a DNS change. WordPress stays installed, untouched and reachable on its current host during and after launch, so rolling back is reversing that DNS change.

## Before launch (T-7 to T-1 days)

- [ ] Preview deployment passes every **Must** in `ACCEPTANCE_CRITERIA.md` (evidence in `QA_REPORT.md`).
- [ ] Owner has reviewed the preview and approved launch (date, name, in writing).
- [ ] Record current DNS for `lexpraxisng.com` and `www` in Cloudflare (screenshot + values) — this is the rollback target.
- [ ] Lower the TTL of those records to 300 seconds at least 24 hours before launch.
- [ ] Full WordPress backup: database export + `wp-content/` archive, stored outside the hosting account.
- [ ] Find out the WordPress host's direct address (origin IP or host name) and confirm the site answers on it, so it can still be reached after DNS moves (e.g. for exports).
- [ ] Resend domain verified; staff inbox receives a test email from the preview.
- [ ] Search Console verified by **DNS TXT** (survives the platform change).
- [ ] Agree the content freeze window with the firm (no WordPress edits from T-1 until launch).

## Launch (T-0)

1. Freeze content in WordPress.
2. `npm run wp:export && npm run migrate:media && npm run migrate:content && npm run migrate:report` against production. Check the report has no new mismatches.
3. Promote the approved deployment to Production in Vercel.
4. Change DNS in Cloudflare to Vercel. Note the time.
5. Smoke test (15 minutes):
   - [ ] `/`, a service, a legal-document form, a blog post, `/blog/page/2/`, a category, `/contact-us/`, `/book-appointment/` return 200 and look right.
   - [ ] `/practice-areas/`, `/?p=12120`, `/2026/10/22/`, `/sitemap_index.xml` redirect correctly.
   - [ ] `/robots.txt` allows crawling and lists the sitemap; `/sitemap.xml` loads.
   - [ ] Submit the contact form with a real address → enquiry appears in the admin → staff and confirmation emails arrive.
   - [ ] Admin sign-in works; publish a small edit and see it live.
   - [ ] Tag Assistant: GTM container fires once per page view.
6. Re-crawl: `npm run seo:crawl -- migration/baseline/sitemap-urls.txt migration/launch-crawl.csv` and compare with the baseline.
7. Submit `https://lexpraxisng.com/sitemap.xml` in Search Console.

## Rollback

Trigger if any of these happen and cannot be fixed within 60 minutes: forms do not store enquiries, emails cannot be delivered, the admin is unusable, widespread 404/500s, or a security issue.

1. In Cloudflare, restore the DNS records recorded before launch. With TTL 300 most visitors return to WordPress within 5–15 minutes.
2. Re-enable WordPress editing; tell staff which system is live.
3. Export any enquiries received on the new site during the window from Admin → Enquiries → Export CSV and pass them to the team (they stay safely in Neon).
4. Fix, re-test on preview, and schedule a new launch.

Code-only problems after launch don't need a DNS rollback: in Vercel, "Promote" the previous production deployment (instant). Database problems: restore a Neon branch from before the incident (point-in-time) and point `DATABASE_URL` at it.

## After launch

- Day 1, 7 and 30: re-crawl and compare; review Search Console coverage, 404s and the Redirects screen (hits on old URLs).
- Keep WordPress and its backups for at least 90 days (agree the period with the firm). Restrict access to it (password-protect or allow-list) once it is no longer public. **Do not delete it without written approval.**
- Cancel WooCommerce/plugin subscriptions only after the shop decision is implemented and the rollback window has passed.
