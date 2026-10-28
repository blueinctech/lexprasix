# WordPress plugin and integration audit

Detected from public REST namespaces (`/wp-json/`) and rendered HTML on 28 Oct 2026. Settings marked **(needs admin)** can only be confirmed with dashboard access.

| Plugin / service | What it does on this site | Stores data? | Replacement in the Next.js build | Status |
|---|---|---|---|---|
| **Yoast SEO** | Titles, descriptions, canonicals, OG/Twitter tags, JSON-LD graph, XML sitemaps, robots block | Post meta (exported via `yoast_head_json`) | Per-record SEO fields in the CMS; `generateMetadata`; JSON-LD builders; `app/sitemap.ts`; `app/robots.ts` | Plan ready; values captured from the REST export |
| **Gravity Forms** (+ Essential Addons GF widget, reCAPTCHA add-on referenced) | 23 multi-page legal-document intake forms with file uploads | **Yes: entries and uploaded files** | Typed form engine (`src/forms`), Zod validation, Postgres submissions, private object storage for uploads, admin inbox, email outbox | Field definitions extracted. Notifications, confirmations and entries **(needs admin)** |
| **Contact Form 7** + **Akismet** | Contact form on `/contact-us/`; Akismet spam honeypot | CF7 stores nothing by default (unless Flamingo, not detected) | Same form engine; honeypot + rate limit + timing check | Fields extracted; recipients **(needs admin)** |
| **WP Mail SMTP** | Sends WordPress mail through an SMTP/API provider | Email log (if Pro) | Resend (or SES) transactional email with outbox table and retry | Current provider/sender **(needs admin)** |
| **Bit Integrations** | Connects forms to external apps (CRM, Sheets, email marketing…) | Integration logs | Re-create each active flow as a webhook/integration step after a submission is stored | Active flows unknown **(needs admin)**. High priority: may be how enquiries reach staff |
| **WooCommerce** (+ Brands, POS, Analytics, push notifications) | Sells one ebook | **Yes: orders, customers** | Decision needed: (a) hosted checkout (Paystack/Flutterwave payment link or Selar) with a product page in the CMS, or (b) drop the shop. Orders kept as an exported archive | **Decision needed** — gateway, price and order volume **(needs admin)** |
| **Elementor** (+ Pro features, AI, One, MCP Composer) | Page layouts for home, about, services, form pages | Layout JSON in post meta | Purpose-built React templates + structured CMS blocks | Content extracted from rendered HTML |
| **Ensaf theme** | Header/footer builder, styling | Template posts | Rebuilt layout | Header/footer template URLs to be redirected |
| **LiteSpeed Cache** | Page cache/optimisation | Cache only | Next.js static rendering + on-demand revalidation; Vercel CDN | Nothing to migrate |
| **Jetpack** | Unknown modules (stats? related posts? social?) | Possibly stats | Related posts built in; analytics via GA4 | Active modules **(needs admin)** |
| **Simple History** | Admin activity log | Log rows | `audit_log` table in the new admin | Old log stays in WP backup |
| **Google Site Kit** | Connects GA4 / Search Console; injects `GT-KDZB6W45` | Settings | Load GA4/GTM directly from site settings; verify Search Console by DNS | Keep IDs; avoid double tagging |
| **WP Abilities / MCP** | Exposes WP to AI agents | No | Not carried over | Not needed |
| **Trustindex** (shortcode) | Google reviews widget on `/review/` | Cached reviews | Option A: keep the Trustindex embed. Option B: import verified reviews into a Testimonials model with source links | **Decision needed** |
| **Calendly** (embed) | 30-minute discovery call booking | In Calendly | Keep the Calendly inline embed and popup; send `utm` parameters; optional webhook later | Keep |
| **Tawk.to** | Live chat widget | In Tawk.to | Keep, loaded after interaction/idle so it doesn't slow first paint; toggle in site settings | Keep |
| **WhatsApp floating button** (Elementor floating buttons) | Click-to-chat | No | Built-in floating WhatsApp button; number in site settings | Number **(needs admin)** or confirmation |
| **Google Tag Manager / GA4 / Google Ads** | Analytics and ad conversions | In Google | Load GTM from settings; fire form-success and booking events to the dataLayer | Container contents **(needs GTM access)** |

## Things that are not plugins but must be preserved

- Cloudflare email obfuscation (not needed on the new site; emails are rendered as plain `mailto:` links, with a spam-safe form as the main path).
- `?p=ID` short links → handled by a legacy-ID redirect table.
- RSS feed `/feed/` → rebuilt as `app/feed/route.ts`.
