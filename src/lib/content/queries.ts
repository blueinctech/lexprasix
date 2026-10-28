import "server-only";
import { and, asc, count, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { mediaBaseUrl } from "@/lib/env";
import { DEFAULT_SETTINGS, settingsSchemas, type SettingKey, type Settings } from "@/lib/settings-schema";

// Read-side data access for the public website. Every function returns only
// published content, is cached with "use cache", and is tagged so admin saves
// (updateTag) refresh exactly what changed.

export const TAGS = {
  settings: "settings",
  menus: "menus",
  pages: "pages",
  services: "services",
  documents: "documents",
  posts: "posts",
  taxonomies: "taxonomies",
  authors: "authors",
  testimonials: "testimonials",
  media: "media",
  redirects: "redirects",
} as const;

export const PER_PAGE = 12;

export type ImageInfo = { url: string; alt: string; width: number | null; height: number | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const published = (t: { status: any; publishedAt: any }) => and(eq(t.status, "published"), lte(t.publishedAt, sql`now()`));

/** Rewrites root-relative upload paths in stored HTML to the media host. */
export function resolveMediaInHtml(html: string): string {
  const base = mediaBaseUrl();
  return html.replace(/(src|href)="\/wp-content\/uploads\//g, `$1="${base}/wp-content/uploads/`);
}

function imageFrom(row: { key: string | null; alt: string | null; width: number | null; height: number | null } | null | undefined): ImageInfo | null {
  if (!row?.key) return null;
  return { url: `${mediaBaseUrl()}/${row.key}`, alt: row.alt ?? "", width: row.width, height: row.height };
}

async function imagesByIds(ids: (string | null | undefined)[]): Promise<Map<string, ImageInfo>> {
  const wanted = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!wanted.length) return new Map();
  const db = await getDb();
  const rows = await db.select({ id: s.media.id, key: s.media.key, alt: s.media.alt, width: s.media.width, height: s.media.height }).from(s.media).where(inArray(s.media.id, wanted));
  return new Map(rows.map((r) => [r.id, imageFrom(r)!]));
}

// ---------------------------------------------------------------- settings & menus

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("max");
  const db = await getDb();
  const rows = await db.select().from(s.settings);
  const out = { ...DEFAULT_SETTINGS } as Settings;
  for (const row of rows) {
    const key = row.key as SettingKey;
    if (!(key in settingsSchemas)) continue;
    const parsed = settingsSchemas[key].safeParse(row.value);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export async function getMenu(key: string): Promise<s.MenuItem[]> {
  "use cache";
  cacheTag(TAGS.menus);
  cacheLife("max");
  const db = await getDb();
  const [row] = await db.select({ items: s.menus.items }).from(s.menus).where(eq(s.menus.key, key));
  return row?.items ?? [];
}

// ---------------------------------------------------------------- pages

export async function getPageByPath(path: string) {
  "use cache";
  cacheTag(TAGS.pages, `page:${path}`);
  cacheLife("max");
  const db = await getDb();
  const [page] = await db.select().from(s.pages).where(and(eq(s.pages.path, path), published(s.pages)));
  if (!page) return null;
  const images = await imagesByIds([page.featuredImageId, page.seo.ogImageId]);
  return { ...page, featuredImage: images.get(page.featuredImageId ?? "") ?? null, ogImage: images.get(page.seo.ogImageId ?? "") ?? null };
}

// ---------------------------------------------------------------- services & documents

export async function listServices() {
  "use cache";
  cacheTag(TAGS.services);
  cacheLife("max");
  const db = await getDb();
  return db
    .select({ id: s.services.id, slug: s.services.slug, title: s.services.title, shortTitle: s.services.shortTitle, summary: s.services.summary, icon: s.services.icon })
    .from(s.services)
    .where(published(s.services))
    .orderBy(asc(s.services.sortOrder), asc(s.services.title));
}

export async function getService(slug: string) {
  "use cache";
  cacheTag(TAGS.services, `service:${slug}`);
  cacheLife("max");
  const db = await getDb();
  const [svc] = await db.select().from(s.services).where(and(eq(s.services.slug, slug), published(s.services)));
  if (!svc) return null;
  const related = svc.relatedServiceIds.length
    ? await db.select({ slug: s.services.slug, title: s.services.title, summary: s.services.summary, icon: s.services.icon }).from(s.services).where(and(inArray(s.services.id, svc.relatedServiceIds), published(s.services)))
    : [];
  const docs = svc.relatedDocumentIds.length
    ? await db.select({ slug: s.documents.slug, title: s.documents.title }).from(s.documents).where(and(inArray(s.documents.id, svc.relatedDocumentIds), published(s.documents)))
    : [];
  const images = await imagesByIds([svc.featuredImageId, svc.seo.ogImageId]);
  return { ...svc, related, documents: docs, featuredImage: images.get(svc.featuredImageId ?? "") ?? null, ogImage: images.get(svc.seo.ogImageId ?? "") ?? null };
}

export async function listDocuments(group?: string) {
  "use cache";
  cacheTag(TAGS.documents);
  cacheLife("max");
  const db = await getDb();
  return db
    .select({ id: s.documents.id, slug: s.documents.slug, title: s.documents.title, group: s.documents.group, summary: s.documents.summary })
    .from(s.documents)
    .where(group ? and(published(s.documents), eq(s.documents.group, group)) : published(s.documents))
    .orderBy(asc(s.documents.sortOrder));
}

export async function getDocument(slug: string) {
  "use cache";
  cacheTag(TAGS.documents, `document:${slug}`);
  cacheLife("max");
  const db = await getDb();
  const [doc] = await db.select().from(s.documents).where(and(eq(s.documents.slug, slug), published(s.documents)));
  if (!doc) return null;
  const images = await imagesByIds([doc.featuredImageId, doc.seo.ogImageId]);
  return { ...doc, featuredImage: images.get(doc.featuredImageId ?? "") ?? null, ogImage: images.get(doc.seo.ogImageId ?? "") ?? null };
}

// ---------------------------------------------------------------- posts

export type PostCard = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: Date;
  readingMinutes: number;
  image: ImageInfo | null;
  author: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
};

type ListFilter = { category?: string; tag?: string; author?: string; q?: string };

async function cardsFor(rows: { id: string; slug: string; title: string; excerpt: string; publishedAt: Date | null; readingMinutes: number; featuredImageId: string | null; authorId: string | null }[]): Promise<PostCard[]> {
  if (!rows.length) return [];
  const db = await getDb();
  const ids = rows.map((r) => r.id);
  const [images, authorRows, catRows] = await Promise.all([
    imagesByIds(rows.map((r) => r.featuredImageId)),
    db.select({ id: s.authors.id, name: s.authors.name, slug: s.authors.slug }).from(s.authors).where(inArray(s.authors.id, rows.map((r) => r.authorId).filter((x): x is string => Boolean(x)).concat(["00000000-0000-0000-0000-000000000000"]))),
    db
      .select({ postId: s.postCategories.postId, name: s.categories.name, slug: s.categories.slug })
      .from(s.postCategories)
      .innerJoin(s.categories, eq(s.categories.id, s.postCategories.categoryId))
      .where(and(inArray(s.postCategories.postId, ids), ne(s.categories.slug, "blog"), ne(s.categories.slug, "uncategorized"))),
  ]);
  const authorMap = new Map(authorRows.map((a) => [a.id, { name: a.name, slug: a.slug }]));
  const catMap = new Map<string, { name: string; slug: string }>();
  for (const c of catRows) if (!catMap.has(c.postId)) catMap.set(c.postId, { name: c.name, slug: c.slug });
  return rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    publishedAt: r.publishedAt ?? new Date(0),
    readingMinutes: r.readingMinutes,
    image: images.get(r.featuredImageId ?? "") ?? null,
    author: r.authorId ? (authorMap.get(r.authorId) ?? null) : null,
    category: catMap.get(r.id) ?? null,
  }));
}

export async function listPosts(page = 1, filter: ListFilter = {}): Promise<{ items: PostCard[]; total: number; pages: number }> {
  "use cache";
  cacheTag(TAGS.posts, TAGS.taxonomies, TAGS.authors);
  cacheLife("max");
  const db = await getDb();
  const conds = [published(s.posts)];
  if (filter.category) {
    conds.push(sql`${s.posts.id} in (select pc.post_id from post_categories pc join categories c on c.id = pc.category_id where c.slug = ${filter.category})`);
  }
  if (filter.tag) {
    conds.push(sql`${s.posts.id} in (select pt.post_id from post_tags pt join tags t on t.id = pt.tag_id where t.slug = ${filter.tag})`);
  }
  if (filter.author) {
    conds.push(sql`${s.posts.authorId} = (select id from authors where slug = ${filter.author})`);
  }
  if (filter.q) {
    conds.push(sql`to_tsvector('english', ${s.posts.title} || ' ' || ${s.posts.excerpt}) @@ websearch_to_tsquery('english', ${filter.q})`);
  }
  const where = and(...conds);
  const [{ n }] = await db.select({ n: count() }).from(s.posts).where(where);
  const rows = await db
    .select({ id: s.posts.id, slug: s.posts.slug, title: s.posts.title, excerpt: s.posts.excerpt, publishedAt: s.posts.publishedAt, readingMinutes: s.posts.readingMinutes, featuredImageId: s.posts.featuredImageId, authorId: s.posts.authorId })
    .from(s.posts)
    .where(where)
    .orderBy(desc(s.posts.publishedAt))
    .limit(PER_PAGE)
    .offset((page - 1) * PER_PAGE);
  return { items: await cardsFor(rows), total: n, pages: Math.max(1, Math.ceil(n / PER_PAGE)) };
}

export async function latestPosts(n: number): Promise<PostCard[]> {
  "use cache";
  cacheTag(TAGS.posts);
  cacheLife("max");
  const db = await getDb();
  const rows = await db
    .select({ id: s.posts.id, slug: s.posts.slug, title: s.posts.title, excerpt: s.posts.excerpt, publishedAt: s.posts.publishedAt, readingMinutes: s.posts.readingMinutes, featuredImageId: s.posts.featuredImageId, authorId: s.posts.authorId })
    .from(s.posts)
    .where(published(s.posts))
    .orderBy(desc(s.posts.publishedAt))
    .limit(n);
  return cardsFor(rows);
}

export async function getPost(slug: string) {
  "use cache";
  cacheTag(TAGS.posts, `post:${slug}`);
  cacheLife("max");
  const db = await getDb();
  const [post] = await db.select().from(s.posts).where(and(eq(s.posts.slug, slug), published(s.posts)));
  if (!post) return null;
  const [author] = post.authorId ? await db.select().from(s.authors).where(eq(s.authors.id, post.authorId)) : [];
  const cats = await db.select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug }).from(s.postCategories).innerJoin(s.categories, eq(s.categories.id, s.postCategories.categoryId)).where(eq(s.postCategories.postId, post.id));
  const tagRows = await db.select({ name: s.tags.name, slug: s.tags.slug }).from(s.postTags).innerJoin(s.tags, eq(s.tags.id, s.postTags.tagId)).where(eq(s.postTags.postId, post.id));
  const commentRows = await db
    .select({ id: s.comments.id, parentId: s.comments.parentId, authorName: s.comments.authorName, html: s.comments.html, isStaffReply: s.comments.isStaffReply, createdAt: s.comments.createdAt })
    .from(s.comments)
    .where(and(eq(s.comments.postId, post.id), eq(s.comments.status, "approved")))
    .orderBy(asc(s.comments.createdAt));

  // Related: most shared categories/tags, newest first.
  const topical = cats.filter((c) => !["blog", "uncategorized"].includes(c.slug)).map((c) => c.id);
  const relatedRows = await db
    .select({ id: s.posts.id, slug: s.posts.slug, title: s.posts.title, excerpt: s.posts.excerpt, publishedAt: s.posts.publishedAt, readingMinutes: s.posts.readingMinutes, featuredImageId: s.posts.featuredImageId, authorId: s.posts.authorId })
    .from(s.posts)
    .where(
      and(
        published(s.posts),
        ne(s.posts.id, post.id),
        topical.length
          ? sql`${s.posts.id} in (select post_id from post_categories where category_id in (${sql.join(topical.map((t) => sql`${t}`), sql`, `)}))`
          : sql`true`,
      ),
    )
    .orderBy(desc(s.posts.publishedAt))
    .limit(3);
  const images = await imagesByIds([post.featuredImageId, post.seo.ogImageId, author?.photoId]);
  return {
    ...post,
    html: resolveMediaInHtml(post.html),
    featuredImage: images.get(post.featuredImageId ?? "") ?? null,
    ogImage: images.get(post.seo.ogImageId ?? "") ?? null,
    author: author ? { name: author.name, slug: author.slug, role: author.role, bio: author.bio, photo: images.get(author.photoId ?? "") ?? null } : null,
    categories: cats.map(({ name, slug }) => ({ name, slug })),
    tags: tagRows,
    comments: commentRows.map((c) => ({ ...c, html: resolveMediaInHtml(c.html) })),
    related: await cardsFor(relatedRows),
  };
}

// ---------------------------------------------------------------- taxonomies & authors

export async function getTerm(kind: "category" | "tag", slug: string) {
  "use cache";
  cacheTag(TAGS.taxonomies);
  cacheLife("max");
  const db = await getDb();
  const table = kind === "category" ? s.categories : s.tags;
  const [row] = await db.select().from(table).where(eq(table.slug, slug));
  return row ?? null;
}

export async function getAuthor(slug: string) {
  "use cache";
  cacheTag(TAGS.authors);
  cacheLife("max");
  const db = await getDb();
  const [row] = await db.select().from(s.authors).where(eq(s.authors.slug, slug));
  if (!row) return null;
  const images = await imagesByIds([row.photoId]);
  return { ...row, photo: images.get(row.photoId ?? "") ?? null };
}

export async function listTestimonials() {
  "use cache";
  cacheTag(TAGS.testimonials);
  cacheLife("max");
  const db = await getDb();
  return db
    .select({ id: s.testimonials.id, name: s.testimonials.name, role: s.testimonials.role, quote: s.testimonials.quote, source: s.testimonials.source, sourceUrl: s.testimonials.sourceUrl })
    .from(s.testimonials)
    .where(eq(s.testimonials.status, "published"))
    .orderBy(asc(s.testimonials.sortOrder));
}

// ---------------------------------------------------------------- routing helpers

/** What a root-level /{slug}/ URL is: a post, a legal document, or a CMS page. */
export async function resolveRootSlug(slug: string): Promise<"post" | "document" | "page" | null> {
  "use cache";
  cacheTag(TAGS.posts, TAGS.documents, TAGS.pages);
  cacheLife("max");
  const db = await getDb();
  const [doc] = await db.select({ id: s.documents.id }).from(s.documents).where(and(eq(s.documents.slug, slug), published(s.documents)));
  if (doc) return "document";
  const [page] = await db.select({ id: s.pages.id, template: s.pages.template }).from(s.pages).where(and(eq(s.pages.path, slug), published(s.pages)));
  if (page && page.template !== "index") return "page";
  const [post] = await db.select({ id: s.posts.id }).from(s.posts).where(and(eq(s.posts.slug, slug), published(s.posts)));
  if (post) return "post";
  return null;
}

export async function rootSlugs(): Promise<string[]> {
  const db = await getDb();
  const [p, d, g] = await Promise.all([
    db.select({ slug: s.posts.slug }).from(s.posts).where(published(s.posts)),
    db.select({ slug: s.documents.slug }).from(s.documents).where(published(s.documents)),
    db.select({ slug: s.pages.path }).from(s.pages).where(and(published(s.pages), ne(s.pages.template, "index"), ne(s.pages.path, ""))),
  ]);
  return [...p, ...d, ...g].map((r) => r.slug).filter((x) => !x.includes("/"));
}

export async function sitemapEntries() {
  "use cache";
  cacheTag(TAGS.posts, TAGS.pages, TAGS.services, TAGS.documents, TAGS.taxonomies, TAGS.authors);
  cacheLife("hours");
  const db = await getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notNoindex = (t: { seo: any }) => sql`coalesce((${t.seo}->>'noindex')::boolean, false) = false`;
  const [pages, services, documents, posts, cats, tags, authors] = await Promise.all([
    db.select({ path: s.pages.path, updatedAt: s.pages.updatedAt }).from(s.pages).where(and(published(s.pages), notNoindex(s.pages))),
    db.select({ slug: s.services.slug, updatedAt: s.services.updatedAt }).from(s.services).where(and(published(s.services), notNoindex(s.services))),
    db.select({ slug: s.documents.slug, updatedAt: s.documents.updatedAt }).from(s.documents).where(and(published(s.documents), notNoindex(s.documents))),
    db.select({ slug: s.posts.slug, updatedAt: s.posts.contentUpdatedAt, imageId: s.posts.featuredImageId }).from(s.posts).where(and(published(s.posts), notNoindex(s.posts))),
    db.select({ slug: s.categories.slug }).from(s.categories).where(sql`exists (select 1 from post_categories pc join posts p on p.id = pc.post_id where pc.category_id = ${s.categories.id} and p.status = 'published')`),
    db.select({ slug: s.tags.slug }).from(s.tags).where(sql`exists (select 1 from post_tags pt join posts p on p.id = pt.post_id where pt.tag_id = ${s.tags.id} and p.status = 'published')`),
    db.select({ slug: s.authors.slug }).from(s.authors).where(sql`exists (select 1 from posts p where p.author_id = ${s.authors.id} and p.status = 'published')`),
  ]);
  return { pages, services, documents, posts, cats, tags, authors };
}

export async function getImage(id: string | null): Promise<ImageInfo | null> {
  "use cache";
  cacheTag(TAGS.media);
  cacheLife("max");
  if (!id) return null;
  return (await imagesByIds([id])).get(id) ?? null;
}

/** Redirect configured in the admin for an exact path (normalised with trailing slash). */
export async function getRedirect(path: string): Promise<{ destination: string; statusCode: number } | null> {
  "use cache";
  cacheTag(TAGS.redirects);
  cacheLife("max");
  const db = await getDb();
  const [row] = await db.select({ destination: s.redirects.destination, statusCode: s.redirects.statusCode }).from(s.redirects).where(eq(s.redirects.source, path));
  return row ?? null;
}

/** Build-time params for archive routes: every term/author with posts, and its page count. */
export async function archiveParams(kind: "category" | "tag" | "author"): Promise<{ slug: string; pages: number }[]> {
  const db = await getDb();
  const rows =
    kind === "author"
      ? await db.select({ slug: s.authors.slug, n: count() }).from(s.posts).innerJoin(s.authors, eq(s.authors.id, s.posts.authorId)).where(published(s.posts)).groupBy(s.authors.slug)
      : kind === "category"
        ? await db.select({ slug: s.categories.slug, n: count() }).from(s.postCategories).innerJoin(s.categories, eq(s.categories.id, s.postCategories.categoryId)).innerJoin(s.posts, eq(s.posts.id, s.postCategories.postId)).where(published(s.posts)).groupBy(s.categories.slug)
        : await db.select({ slug: s.tags.slug, n: count() }).from(s.postTags).innerJoin(s.tags, eq(s.tags.id, s.postTags.tagId)).innerJoin(s.posts, eq(s.posts.id, s.postTags.postId)).where(published(s.posts)).groupBy(s.tags.slug);
  return rows.map((r) => ({ slug: r.slug, pages: Math.max(1, Math.ceil(r.n / PER_PAGE)) }));
}
