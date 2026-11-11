import "server-only";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { comments, posts } from "@/db/schema";
import { appUrl, staffRecipients } from "@/lib/env";
import { enqueueEmails, processOutbox } from "@/lib/email/outbox";
import { escapeHtml } from "@/lib/email/templates";
import { hmac } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";

// Public comments on blog posts. Every comment waits for approval in
// Admin → Comments before it appears; staff get an email for each one.
// Spam checks: a hidden honeypot field, a minimum time on the form, rate limits
// per IP and per email, and comments with several links go straight to spam.

export type CommentPayload = { postId: string; parentId?: string | null; name: string; email: string; comment: string; website?: string; elapsedMs?: number };
export type CommentResult = { ok: true; message: string } | { ok: false; error: string; fields?: Record<string, string> };

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_FILL_MS = 3000;
const THANKS = "Thank you. Your comment has been received and will appear once it has been approved.";

/** Plain text in, safe HTML out: paragraphs and line breaks only (no links, so spam links aren't clickable). */
export function commentHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export async function submitComment(p: CommentPayload, ctx: RequestContext): Promise<CommentResult> {
  const name = String(p.name ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  const email = String(p.email ?? "").trim().toLowerCase();
  const text = String(p.comment ?? "").replace(/\r\n?/g, "\n").trim();
  const fields: Record<string, string> = {};
  if (name.length < 2 || name.length > 80) fields.name = "Enter your name (2–80 characters).";
  if (!EMAIL.test(email) || email.length > 200) fields.email = "Enter a valid email address.";
  if (text.length < 3) fields.comment = "Write your comment.";
  else if (text.length > 3000) fields.comment = "Comments can be up to 3,000 characters.";
  if (Object.keys(fields).length) return { ok: false, error: "Please check the highlighted fields.", fields };
  if (!UUID.test(String(p.postId)) || (p.parentId && !UUID.test(String(p.parentId)))) return { ok: false, error: "This article can't take comments." };

  // Bots fill the hidden field or submit instantly: pretend success, store nothing.
  if (p.website || (typeof p.elapsedMs === "number" && p.elapsedMs < MIN_FILL_MS)) return { ok: true, message: THANKS };

  const limited = await rateLimit("commentByIp", ctx.ipHash ?? "unknown");
  const limitedEmail = await rateLimit("commentByEmail", hmac("rl-comment", email).slice(0, 32));
  if (!limited.success || !limitedEmail.success) return { ok: false, error: "You've posted several comments in a short time. Please try again later." };

  const db = await getDb();
  const [post] = await db.select({ id: posts.id, title: posts.title, slug: posts.slug, status: posts.status, commentsOpen: posts.commentsOpen }).from(posts).where(eq(posts.id, p.postId));
  if (!post || post.status !== "published" || !post.commentsOpen) return { ok: false, error: "Comments are closed on this article." };
  if (p.parentId) {
    const [parent] = await db.select({ id: comments.id }).from(comments).where(and(eq(comments.id, p.parentId), eq(comments.postId, post.id), eq(comments.status, "approved")));
    if (!parent) return { ok: false, error: "The comment you're replying to is no longer available." };
  }

  const links = (text.match(/https?:\/\/|www\./gi) ?? []).length;
  const status = links > 2 ? "spam" : "pending";
  const [row] = await db
    .insert(comments)
    .values({ postId: post.id, parentId: p.parentId || null, authorName: name, authorEmail: email, html: commentHtml(text), status, ipHash: ctx.ipHash })
    .returning({ id: comments.id });

  if (status === "pending") {
    try {
      const ids = await enqueueEmails([
        {
          idempotencyKey: `comment:${row.id}:staff`,
          template: "comment.staff",
          to: staffRecipients(),
          replyTo: email,
          subject: `New comment on "${post.title.slice(0, 80)}" from ${name}`,
          payload: { name, email, postTitle: post.title, postUrl: `${appUrl()}/${post.slug}/`, excerpt: text.slice(0, 600), adminUrl: `${appUrl()}/admin/comments/` },
        },
      ]);
      after(() => processOutbox({ ids }).catch((err) => logger.error("Comment email failed", { err })));
    } catch (err) {
      logger.error("Comment email not queued", { err });
    }
  }
  return { ok: true, message: THANKS };
}
