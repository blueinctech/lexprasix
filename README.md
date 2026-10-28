# LexPraxis Solicitors — website and CMS

Next.js rebuild of [lexpraxisng.com](https://lexpraxisng.com/) (currently WordPress), with a private admin for pages, posts, services, legal-document forms, media, menus, settings and client enquiries.

**Status:** Phase A (audit and plan) complete; Phase B (foundation) started. The WordPress site stays live until launch is approved.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM + Neon Postgres · Cloudflare R2 (S3 API) for media and private uploads · Resend for email · Vercel hosting. Reasons are in [docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:migrate           # apply drizzle/ migrations
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run wp:export` | Read-only export of public WordPress content to `migration/wp-export/` |
| `npm run seo:crawl -- <urls.txt> <out.csv> [origin]` | SEO crawl (baseline or comparison against a preview origin) |
| `node scripts/extract-forms.mjs` | Gravity Forms / CF7 field definitions → `migration/forms/` |
| `node scripts/build-inventory.mjs` | Regenerates `docs/PAGE_INVENTORY.csv` |
| `npm run db:generate` | New SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (uses `DATABASE_URL_UNPOOLED`) |

## Documentation

- [Website audit](docs/WEBSITE_AUDIT.md) · [Page inventory](docs/PAGE_INVENTORY.csv) · [Feature inventory](docs/FEATURE_INVENTORY.md)
- [WordPress plugin audit](docs/WORDPRESS_PLUGIN_AUDIT.md) · [SEO baseline](docs/SEO_BASELINE.md) · [Redirect map](docs/REDIRECT_MAP.csv)
- [Migration plan](docs/MIGRATION_PLAN.md) · [Acceptance criteria](docs/ACCEPTANCE_CRITERIA.md)
