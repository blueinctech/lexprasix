# Deployment guide

How to run LexPraxis locally, set up the production services, deploy to Vercel and keep the database safe. Nothing here changes the live WordPress site; DNS changes happen only at launch (see `ROLLBACK_PLAN.md` and the launch checklist below).

## 1. Local development

```bash
npm install
cp .env.example .env.local        # then edit; see section 3
npm run db:local                  # real PostgreSQL 18 in .data/postgres (leave running)
npm run db:migrate                # apply drizzle/ migrations
npm run wp:export                 # read-only export of lexpraxisng.com (public REST API)
npm run migrate:content           # import posts, pages, services, documents, media rows, menus...
npm run admin:create -- --email you@example.com --name "Your Name"   # prints a one-time link
npm run dev
```

Stop the local database with `npm run db:local:stop` (stopping the terminal task alone can leave `postgres.exe` running on Windows).

Without email or storage credentials, development falls back safely: emails are written to `.data/mail/*.html`, uploads go to `.data/uploads` and `.data/media`. **Production refuses these fallbacks** and reports the missing configuration instead.

## 2. Production services

| Service | Purpose | Setup |
|---|---|---|
| **Vercel** | Hosting, preview deployments, cron | Import `blueinctech/lexprasix`; framework Next.js. Production branch `main`; every other branch gets a preview |
| **Neon Postgres** | Database | Add via Vercel → Storage → Neon (sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`). Enable "create a branch per preview deployment" so previews never touch production data. Region: closest to Lagos available (e.g. `aws-eu-central-1` or `aws-eu-west-2`) |
| **Cloudflare R2** | Media (public) and client documents (private) | Create buckets `lexpraxis-media` (connect custom domain `media.lexpraxisng.com`, public) and `lexpraxis-uploads` (no public access). Create an R2 API token with Object Read & Write on both. CORS on `lexpraxis-uploads`: allow `PUT` from `https://lexpraxisng.com` and your preview domain with header `Content-Type` |
| **Resend** | Transactional email | Add domain `lexpraxisng.com`, add the SPF/DKIM records it shows to Cloudflare DNS, verify. Add a DMARC record (`_dmarc` TXT `v=DMARC1; p=none; rua=mailto:info@lexpraxisng.com`) then tighten to `quarantine` after a few weeks of clean reports |

## 3. Environment variables

Set these in Vercel (Production and Preview separately). Names and meaning are in `.env.example`; never commit real values.

| Variable | Production | Preview |
|---|---|---|
| `SITE_ENV` | `production` | `preview` (forces noindex) |
| `NEXT_PUBLIC_SITE_URL` | `https://lexpraxisng.com` | `https://lexpraxisng.com` (canonical stays production) |
| `APP_URL` | — | optional; preview links in emails default to `VERCEL_URL` |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon main branch | Neon preview branch (automatic) |
| `AUTH_SECRET` | 48+ random bytes (`openssl rand -base64 48`) | different value |
| `S3_ENDPOINT`, `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_MEDIA_BUCKET`, `S3_UPLOADS_BUCKET` | R2 | R2 (separate `-preview` buckets recommended) |
| `NEXT_PUBLIC_MEDIA_URL` | `https://media.lexpraxisng.com` | same |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_STAFF_TO` | real | real key, but `EMAIL_STAFF_TO` set to a test inbox |
| `CRON_SECRET` | random | random |
| `ENQUIRY_RETENTION_DAYS` | agreed with the firm (e.g. `730`) | `30` |

## 4. Database migrations

- Schema changes: edit `src/db/schema.ts` → `npm run db:generate` → review the SQL in `drizzle/` → commit.
- Apply: `npm run db:migrate` (uses `DATABASE_URL_UNPOOLED`). Run it **before** promoting a deployment that needs the new schema:
  - Preview: run against the preview branch (Neon branch URL) from your machine or a CI job.
  - Production: take a Neon branch snapshot first (Neon keeps point-in-time history; creating a named branch `pre-migration-YYYYMMDD` makes rollback a click), then run the migration, then deploy.
- Migrations are additive by default. Destructive changes (drop/rename) are split into two releases: deploy code that no longer uses the column, then drop it.

## 5. First production data load

```bash
# With production env vars loaded locally (vercel env pull .env.production.local)
npm run db:migrate
npm run wp:export
npm run migrate:media        # copies ~264 MB from WordPress to R2; resumable
npm run migrate:content
npm run migrate:report       # writes docs/MIGRATION_REPORT.md
npm run admin:create -- --email … --name "…"
```

All steps are safe to rerun. Before launch, run `wp:export`, `migrate:media` and `migrate:content` once more after a content freeze to pick up last-minute WordPress edits.

## 6. Scheduled jobs (vercel.json)

| Path | Schedule | Does |
|---|---|---|
| `/api/cron/outbox` | every 5 min | Sends queued emails and retries failures with back-off |
| `/api/cron/publish` | every 5 min | Publishes scheduled posts/pages/services/documents |
| `/api/cron/cleanup` | daily 02:30 UTC | Retention purge, orphaned uploads, expired sessions, old rate-limit rows |

Vercel sends `Authorization: Bearer $CRON_SECRET`; requests without it get 401. Note: Vercel Hobby plans only allow daily crons — the 5-minute jobs need a Pro plan (emails are still sent immediately after each submission; cron is the retry path).

## 7. Backups and recovery

- **Neon**: point-in-time restore (7 days on Launch, 30 days on Scale plans). Test once before launch: create a branch from "1 hour ago", run `npm run migrate:report` against it, delete it. Record the result in `QA_REPORT.md`.
- **R2**: enable object versioning on `lexpraxis-uploads` (client documents) or a nightly copy to a second bucket.
- **Code**: GitHub. Every deployment is immutable in Vercel and can be promoted back instantly.

## 8. Launch checklist (summary — full version in ROLLBACK_PLAN.md)

1. All **Must** criteria in `ACCEPTANCE_CRITERIA.md` verified on the preview.
2. Content freeze in WordPress; final `wp:export` + `migrate:media` + `migrate:content`.
3. WordPress database and `wp-content` backup downloaded and stored.
4. Owner approval recorded.
5. Add `lexpraxisng.com` and `www.lexpraxisng.com` to the Vercel project (www → apex redirect).
6. In Cloudflare, change the apex and `www` records to Vercel's targets (keep TTL low; proxy off or "DNS only" per Vercel guidance).
7. Smoke test, re-crawl (`npm run seo:crawl -- migration/baseline/sitemap-urls.txt migration/post-launch.csv`), submit a real test enquiry, confirm emails, submit the sitemap in Search Console.
