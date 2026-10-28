# LexPraxis Solicitors — website and CMS

Next.js rebuild of [lexpraxisng.com](https://lexpraxisng.com/) (currently WordPress) with a private admin for pages, articles, services, legal-document questionnaires, media, menus, settings and client enquiries. The WordPress site stays live until the launch is approved (see [docs/ROLLBACK_PLAN.md](docs/ROLLBACK_PLAN.md)).

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM + PostgreSQL (Neon in production, embedded PostgreSQL locally) · Cloudflare R2 via the S3 API (public media + private client documents) · Resend (transactional email with a durable outbox) · Vercel (hosting + cron). Reasons are in [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).

## Quick start

```bash
npm install
cp .env.example .env.local
npm run db:local          # real PostgreSQL in .data/ — keep running in its own terminal
npm run db:migrate
npm run wp:export         # read-only export of the WordPress site
npm run migrate:content   # import into the database
npm run admin:create -- --email you@example.com --name "Your Name"
npm run dev               # http://localhost:3000, admin at /admin/
```

## What's where

| Path | Contents |
|---|---|
| `src/app/(site)` | Public routes. URLs match WordPress (`/{post}/`, `/service/{slug}/`, `/category/{slug}/page/2/` …) |
| `src/app/admin` | Admin: sign-in, dashboard, enquiries, content editors, media, menus, settings, users, redirects, logs |
| `src/app/api` | Upload signing, cron jobs |
| `src/components` | `blocks/` page-builder sections, `content/` public templates, `forms/` public forms, `admin/` admin UI |
| `src/forms` | Form engine: definitions (one per legal document, generated from Gravity Forms), validation, submission + uploads |
| `src/lib` | Auth, permissions, email outbox, storage, SEO, sanitising, cached content queries, background jobs |
| `src/db` | Drizzle schema; migrations in `drizzle/` |
| `scripts` | Export, import, media copy, reports, crawler, local database |
| `tests` | `unit/`, `integration/` (real database), `e2e/` (Playwright) |
| `docs` | Audit, plans, reports, guides |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:local` / `db:local:stop` | Start/stop the local PostgreSQL server |
| `npm run db:generate` / `db:migrate` | New SQL migration from the schema / apply migrations |
| `npm run wp:export` | Read-only WordPress REST export → `migration/wp-export/` |
| `npm run migrate:content` | Idempotent import of content, taxonomies, authors, comments, menus, settings, redirects |
| `npm run migrate:media` | Copy media files from WordPress to storage (resumable) |
| `npm run migrate:report` | Reconciliation report → `docs/MIGRATION_REPORT.md` |
| `npm run seo:crawl -- <urls> <out.csv> [origin]` | SEO crawl; `node scripts/seo-compare.mjs` writes `docs/SEO_MIGRATION_REPORT.md` |
| `npm run admin:create` | Create/re-invite an administrator (prints a one-time link) |
| `npm test` | Unit + integration tests (needs `db:local` running) |
| `npm run test:e2e` | Playwright against a production build on port 3200 (uses installed Edge/Chrome) |

## Documentation

- Audit: [Website audit](docs/WEBSITE_AUDIT.md) · [Page inventory](docs/PAGE_INVENTORY.csv) · [Feature inventory](docs/FEATURE_INVENTORY.md) · [Plugin audit](docs/WORDPRESS_PLUGIN_AUDIT.md) · [SEO baseline](docs/SEO_BASELINE.md)
- Plan: [Migration plan](docs/MIGRATION_PLAN.md) · [Acceptance criteria](docs/ACCEPTANCE_CRITERIA.md) · [Redirect map](docs/REDIRECT_MAP.csv)
- Results: [Migration report](docs/MIGRATION_REPORT.md) · [SEO migration report](docs/SEO_MIGRATION_REPORT.md) · [QA report](docs/QA_REPORT.md)
- Operations: [Deployment](docs/DEPLOYMENT.md) · [Admin guide](docs/ADMIN_GUIDE.md) · [Launch & rollback](docs/ROLLBACK_PLAN.md)
