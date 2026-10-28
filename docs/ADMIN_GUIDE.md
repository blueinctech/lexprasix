# Admin guide

The admin is at **https://lexpraxisng.com/admin/** (bookmarks to `/wp-admin` redirect there). Changes you publish appear on the website within seconds — no developer needed.

## Signing in

- Accounts are created by invitation (Users → Invite). The email link is valid for 7 days and works once; you choose your own password (12+ characters — a short sentence works well).
- Forgot your password? Use "Forgot your password?" on the sign-in page. The link lasts 60 minutes.
- After 5 wrong passwords the account locks for 15 minutes.
- You're signed out after 2 hours of inactivity or 12 hours in total. Use **Sign out** on shared computers.

## Roles

| Role | Can |
|---|---|
| **Administrator** | Everything, including users, site settings, CSV exports, deleting enquiries, email and activity logs |
| **Editor** | All website content, media, menus, redirects and client enquiries |
| **Author** | Write and edit their own articles as drafts and upload images; an editor publishes |

An Author account must be linked to an author profile (Users → user → Author profile) before it can save articles.

## Client enquiries

**Enquiries** lists every contact form and legal-document questionnaire. New ones are highlighted and counted in the sidebar.

- Open an enquiry to see the client's answers grouped by step, uploaded documents and the emails sent.
- Set the **status** (New → In progress → Awaiting client → Completed / Archived) and **assign** it to a colleague. Add **internal notes** (never shown to the client).
- **Documents** download through a link that expires after 5 minutes. Every view and download is logged.
- Suspected spam is stored separately (filter "Spam") and never emailed. If a real enquiry ends up there, change its status.
- **Export CSV** (administrators) exports the current filter; pick a single form to get one column per question.
- **Delete permanently** (administrators) removes the enquiry and its files — use for data-protection requests.

Each submission also emails the staff inbox and sends the client a confirmation with their reference (e.g. LP-7K2Q9M). If an email fails, it shows in **Email log** with the reason and retries automatically; you can retry by hand.

## Articles (Blog posts)

1. **Blog posts → New article.** Enter the title; the URL is suggested from it (change it before publishing — changing it later creates a redirect automatically).
2. Write in the editor. Use **H2** for main sections and **H3** below them (the article title is the page's only H1). The toolbar has links, lists, quotes, tables and images from the media library.
3. Add an **excerpt** (shown on cards and as the search description if you leave the SEO description empty), a **featured image**, **categories** and **tags**.
4. **Status:** Draft (private), Scheduled (publishes automatically at the date/time, Lagos time) or Published.
5. **Preview** shows the draft exactly as it will look. **Save**.

Every save keeps a revision; restore an earlier version from **Revisions**.

## Pages, services and legal documents

- **Pages** are built from sections (hero, text, services grid, steps, features, FAQs, call to action, offices, contact form, booking calendar, reviews, embeds). Add, reorder or remove sections; each has its own fields.
- The **Figures** section only appears on the site when "verified" is ticked. Only tick it for numbers the firm can stand behind.
- **Services**: name, short name (used on cards and menus), summary, description, who it's for, process steps, FAQs, related services and documents, call to action, order.
- **Legal documents**: the page around each questionnaire (summary, what to prepare, what you receive, FAQs). The questionnaire itself is set up by the developer; ask them to add or change questions.

## SEO fields (every page, article, service and document)

- **SEO title** and **meta description** — leave empty to use the title and summary. The counter turns amber when too long for Google.
- **Canonical URL** — leave empty unless the content officially lives elsewhere.
- **Hide from search engines** — for thank-you pages or internal pages only.
- **Social sharing image** — shown when the page is shared on LinkedIn, WhatsApp etc.

## Media library

Upload by dragging files in (JPG, PNG, WebP, GIF, PDF, Word, Excel, PowerPoint, MP4; up to 15 MB). Always fill in **alt text** for images — describe what the image shows for people using screen readers (the library has a "missing alt text" filter). A file that's used somewhere can't be deleted without confirmation; **Replace** swaps the file but keeps its address.

## Menus, settings and redirects

- **Menus:** header (with the Services and Legal Documents drop-downs) and footer columns. Use quick-add to insert pages, services or documents.
- **Settings** (administrators): business name, email, phones, WhatsApp number, office addresses, social links, header button, Tag Manager ID, Calendly link, chat widget, reviews widget, default SEO text.
- **Redirects:** when you remove or rename a page by hand, add a redirect from the old address to the most relevant new page (never just the homepage). Redirects take effect within a minute. The hit counter shows whether old links are still being used.

## Good practice

- Unpublish (set to Draft) rather than delete; if you must delete something that was live, add a redirect.
- Don't paste client information into articles, notes visible to clients, or the media library.
- Check **Activity log** if something changed unexpectedly — it records who did what and when.
