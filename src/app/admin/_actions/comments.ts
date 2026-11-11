"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { comments, posts } from "@/db/schema";
import { adminAction } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { uuidOrNull } from "@/lib/admin/editing";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { commentHtml } from "@/lib/comments";

// Comment moderation: approve, mark as spam, delete, and reply as the firm.

async function commentWithPost(id: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: comments.id, postId: comments.postId, status: comments.status, authorName: comments.authorName, slug: posts.slug })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, id));
  return row ?? null;
}

export async function setCommentStatus(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("comments.manage", async (user) => {
    const status = String(fd.get("status"));
    if (status !== "approved" && status !== "spam" && status !== "pending") return fail("Unknown status.");
    const row = await commentWithPost(uuidOrNull(fd.get("id")));
    if (!row) return fail("Comment not found.");
    const db = await getDb();
    await db.update(comments).set({ status }).where(eq(comments.id, row.id));
    await audit({ userId: user.id, action: `comment.${status}`, entityType: "comment", entityId: row.id, details: { author: row.authorName } });
    refreshPublic("posts", `post:${row.slug}`);
    return ok(status === "approved" ? "Approved. It now shows on the article." : status === "spam" ? "Marked as spam." : "Moved back to pending.");
  });
}

export async function deleteComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("comments.manage", async (user) => {
    const row = await commentWithPost(uuidOrNull(fd.get("id")));
    if (!row) return fail("Comment not found.");
    const db = await getDb();
    // Replies to it go too, so no orphaned replies remain.
    await db.delete(comments).where(eq(comments.parentId, row.id));
    await db.delete(comments).where(eq(comments.id, row.id));
    await audit({ userId: user.id, action: "comment.delete", entityType: "comment", entityId: row.id, details: { author: row.authorName } });
    refreshPublic("posts", `post:${row.slug}`);
    return ok("Comment deleted.");
  });
}

export async function replyToComment(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("comments.manage", async (user) => {
    const row = await commentWithPost(uuidOrNull(fd.get("id")));
    if (!row) return fail("Comment not found.");
    const text = String(fd.get("reply") ?? "").replace(/\r\n?/g, "\n").trim();
    if (text.length < 2) return fail("Write a reply.", { reply: "Write a reply." });
    if (text.length > 3000) return fail("Replies can be up to 3,000 characters.", { reply: "Too long." });
    const db = await getDb();
    // Replying approves the comment being answered, so both appear together.
    if (row.status !== "approved") await db.update(comments).set({ status: "approved" }).where(eq(comments.id, row.id));
    const [reply] = await db
      .insert(comments)
      .values({ postId: row.postId, parentId: row.id, authorName: user.name, html: commentHtml(text), isStaffReply: true, status: "approved" })
      .returning({ id: comments.id });
    await audit({ userId: user.id, action: "comment.reply", entityType: "comment", entityId: reply.id, details: { to: row.authorName } });
    refreshPublic("posts", `post:${row.slug}`);
    return ok("Reply posted on the article.");
  });
}
