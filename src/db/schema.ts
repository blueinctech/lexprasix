import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Database schema for the LexPraxis site and admin. Kept free of "server-only"
// so migration scripts in scripts/ can import it. JSON columns are typed here;
// their contents are validated with Zod in src/lib/content before saving.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const userRole = pgEnum("user_role", ["administrator", "editor", "author"]);
export const contentStatus = pgEnum("content_status", ["draft", "scheduled", "published"]);
export const submissionStatus = pgEnum("submission_status", ["new", "in_progress", "awaiting_client", "completed", "archived", "spam"]);
export const emailStatus = pgEnum("email_status", ["pending", "sending", "sent", "failed", "skipped"]);
export const commentStatus = pgEnum("comment_status", ["approved", "pending", "spam"]);

export type UserRole = (typeof userRole.enumValues)[number];
export type ContentStatus = (typeof contentStatus.enumValues)[number];
export type SubmissionStatus = (typeof submissionStatus.enumValues)[number];

/** SEO fields stored on every public record. Empty values fall back to defaults. */
export type SeoFields = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImageId?: string | null;
  /** Yoast values as imported, kept for the SEO comparison report. */
  legacy?: Record<string, unknown>;
};

const seo = () => jsonb("seo").$type<SeoFields>().notNull().default({});
const status = () => contentStatus("status").notNull().default("draft");
const publishedAt = () => timestamp("published_at", { withTimezone: true });
const wpId = () => integer("wp_id");

// ---------------------------------------------------------------- staff accounts

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always lower-cased. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: userRole("role").notNull().default("author"),
    isActive: boolean("is_active").notNull().default(true),
    /** scrypt hash; null until an invited user accepts and sets a password. */
    passwordHash: text("password_hash"),
    passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Public author profile this account writes as, if any. */
    authorId: uuid("author_id"),
    invitedById: uuid("invited_by_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie token; the token itself is never stored. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

/** Single-use hashed tokens for invitations and password resets. */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<"invite" | "reset">().notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdById: uuid("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_idx").on(t.tokenHash), index("auth_tokens_user_idx").on(t.userId)],
);

/** Fixed-window rate-limit counters (no Redis needed). */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** e.g. "post.publish", "user.role_change", "submission.export". */
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    /** Non-sensitive details only (never passwords, tokens or client data). */
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt), index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);

// ---------------------------------------------------------------- media

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Object key in the public media bucket, e.g. "wp-content/uploads/2026/01/logo.png". */
    key: text("key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    description: text("description").notNull().default(""),
    sha256: text("sha256"),
    wpId: wpId(),
    /** Original WordPress URL, for rewriting content and redirects. */
    legacyUrl: text("legacy_url"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("media_key_idx").on(t.key), uniqueIndex("media_wp_idx").on(t.wpId), index("media_created_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------- authors & taxonomies

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    bio: text("bio").notNull().default(""),
    photoId: uuid("photo_id").references(() => media.id, { onDelete: "set null" }),
    seo: seo(),
    wpId: wpId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("authors_slug_idx").on(t.slug), uniqueIndex("authors_wp_idx").on(t.wpId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    seo: seo(),
    wpId: wpId(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug), uniqueIndex("categories_wp_idx").on(t.wpId)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    seo: seo(),
    wpId: wpId(),
  },
  (t) => [uniqueIndex("tags_slug_idx").on(t.slug), uniqueIndex("tags_wp_idx").on(t.wpId)],
);

// ---------------------------------------------------------------- content

/** Typed page-builder blocks; shapes are defined in src/lib/content/blocks.ts. */
export type Block = { id: string; type: string } & Record<string, unknown>;

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Full path without slashes at either end, e.g. "about-us"; "" is the homepage. */
    path: text("path").notNull(),
    title: text("title").notNull(),
    /** "default" | "home" | "contact" | "booking" | "legal" | "reviews" | "landing" */
    template: text("template").notNull().default("default"),
    parentId: uuid("parent_id"),
    summary: text("summary").notNull().default(""),
    blocks: jsonb("blocks").$type<Block[]>().notNull().default([]),
    featuredImageId: uuid("featured_image_id").references(() => media.id, { onDelete: "set null" }),
    status: status(),
    publishedAt: publishedAt(),
    seo: seo(),
    wpId: wpId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("pages_path_idx").on(t.path), uniqueIndex("pages_wp_idx").on(t.wpId), index("pages_status_idx").on(t.status)],
);

export type Faq = { question: string; answer: string };

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** Short label for cards and menus, e.g. "Company Formation (Nigeria)". */
    shortTitle: text("short_title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    audience: text("audience").notNull().default(""),
    process: jsonb("process").$type<{ title: string; text: string }[]>().notNull().default([]),
    faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
    relatedServiceIds: uuid("related_service_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    /** Legal document pages relevant to this service. */
    relatedDocumentIds: uuid("related_document_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    ctaLabel: text("cta_label").notNull().default(""),
    ctaHref: text("cta_href").notNull().default(""),
    icon: text("icon").notNull().default(""),
    featuredImageId: uuid("featured_image_id").references(() => media.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    status: status(),
    publishedAt: publishedAt(),
    seo: seo(),
    wpId: wpId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("services_slug_idx").on(t.slug), uniqueIndex("services_wp_idx").on(t.wpId)],
);

/** Legal-document and filing intake pages (each has a form). Served at /{slug}/. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    /** "corporate-filings" | "agreements" */
    group: text("group").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    /** What the client receives / needs to prepare. */
    deliverables: jsonb("deliverables").$type<string[]>().notNull().default([]),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    faqs: jsonb("faqs").$type<Faq[]>().notNull().default([]),
    /** Key of a form definition in src/forms/definitions. */
    formId: text("form_id").notNull(),
    featuredImageId: uuid("featured_image_id").references(() => media.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    status: status(),
    publishedAt: publishedAt(),
    seo: seo(),
    wpId: wpId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("documents_slug_idx").on(t.slug), uniqueIndex("documents_wp_idx").on(t.wpId)],
);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** Sanitised HTML. */
    html: text("html").notNull().default(""),
    authorId: uuid("author_id").references(() => authors.id, { onDelete: "set null" }),
    featuredImageId: uuid("featured_image_id").references(() => media.id, { onDelete: "set null" }),
    status: status(),
    /** Publication date shown to readers (and the schedule time when status = scheduled). */
    publishedAt: publishedAt(),
    /** Last meaningful content update shown to readers. */
    contentUpdatedAt: timestamp("content_updated_at", { withTimezone: true }),
    commentsOpen: boolean("comments_open").notNull().default(false),
    readingMinutes: integer("reading_minutes").notNull().default(1),
    seo: seo(),
    wpId: wpId(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("posts_slug_idx").on(t.slug),
    uniqueIndex("posts_wp_idx").on(t.wpId),
    index("posts_status_published_idx").on(t.status, t.publishedAt),
    index("posts_author_idx").on(t.authorId),
    index("posts_search_idx").using("gin", sql`to_tsvector('english', ${t.title} || ' ' || ${t.excerpt})`),
  ],
);

export const postCategories = pgTable(
  "post_categories",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] }), index("post_categories_category_idx").on(t.categoryId)],
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] }), index("post_tags_tag_idx").on(t.tagId)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    authorName: text("author_name").notNull(),
    /** Sanitised HTML. Commenter emails are not imported. */
    html: text("html").notNull(),
    isStaffReply: boolean("is_staff_reply").notNull().default(false),
    status: commentStatus("status").notNull().default("approved"),
    wpId: wpId(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt), uniqueIndex("comments_wp_idx").on(t.wpId)],
);

/** Previous versions of editable records, written on every save. */
export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: text("entity_type").$type<"page" | "post" | "service" | "document">().notNull(),
    entityId: uuid("entity_id").notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("revisions_entity_idx").on(t.entityType, t.entityId, t.createdAt)],
);

// ---------------------------------------------------------------- navigation & settings

export type MenuItem = { id: string; label: string; href: string; description?: string; children?: MenuItem[] };

export const menus = pgTable("menus", {
  /** "header" | "footer-services" | "footer-company" | "footer-legal" */
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  items: jsonb("items").$type<MenuItem[]>().notNull().default([]),
  updatedAt: updatedAt(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

/** Key/value site settings; each key's value shape is validated in src/lib/settings.ts. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Normalised path with trailing slash, e.g. "/practice-areas/". */
    source: text("source").notNull(),
    destination: text("destination").notNull(),
    statusCode: integer("status_code").notNull().default(301),
    note: text("note").notNull().default(""),
    hits: integer("hits").notNull().default(0),
    lastHitAt: timestamp("last_hit_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("redirects_source_idx").on(t.source)],
);

/** WordPress post/page IDs → current path, for ?p= and ?page_id= links. */
export const legacyIds = pgTable("legacy_ids", {
  wpId: integer("wp_id").primaryKey(),
  wpType: text("wp_type").notNull(),
  path: text("path").notNull(),
});

// ---------------------------------------------------------------- submissions & email

export type SubmissionMeta = {
  ipHash?: string | null;
  userAgent?: string | null;
  pagePath?: string | null;
  referrer?: string | null;
  utm?: Record<string, string>;
  /** Gravity Forms metadata for imported historic entries. */
  legacy?: Record<string, string>;
};

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Human-friendly reference shown to the client, e.g. "LP-24F7K2". */
    reference: text("reference").notNull(),
    formId: text("form_id").notNull(),
    formTitle: text("form_title").notNull(),
    status: submissionStatus("status").notNull().default("new"),
    name: text("name").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    /** Field id → validated value. */
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    consent: jsonb("consent").$type<{ privacy: boolean; marketing?: boolean; text: string; at: string }>(),
    meta: jsonb("meta").$type<SubmissionMeta>().notNull().default({}),
    assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    /** Client-generated key so a retried submit never creates a duplicate. */
    idempotencyKey: text("idempotency_key"),
    legacyEntryId: text("legacy_entry_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("submissions_reference_idx").on(t.reference),
    uniqueIndex("submissions_idempotency_idx").on(t.idempotencyKey),
    uniqueIndex("submissions_legacy_idx").on(t.legacyEntryId),
    index("submissions_form_created_idx").on(t.formId, t.createdAt),
    index("submissions_status_idx").on(t.status, t.createdAt),
  ],
);

export const submissionFiles = pgTable(
  "submission_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    fieldId: text("field_id").notNull(),
    /** Key in the PRIVATE uploads bucket. Never publicly readable. */
    key: text("key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    /** Uploads start unattached (presigned upload) and are claimed when the form is submitted. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("submission_files_key_idx").on(t.key), index("submission_files_submission_idx").on(t.submissionId)],
);

export const submissionNotes = pgTable(
  "submission_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("submission_notes_submission_idx").on(t.submissionId, t.createdAt)],
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Unique per logical email (e.g. "submission:<id>:staff") so retries never send twice. */
    idempotencyKey: text("idempotency_key").notNull(),
    template: text("template").notNull(),
    to: text("to").array().notNull(),
    replyTo: text("reply_to"),
    subject: text("subject").notNull(),
    /** Template props; rendered at send time. */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: emailStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    submissionId: uuid("submission_id").references(() => submissions.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("email_outbox_idempotency_idx").on(t.idempotencyKey), index("email_outbox_due_idx").on(t.status, t.nextAttemptAt)],
);
