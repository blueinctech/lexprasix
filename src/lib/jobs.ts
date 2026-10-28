import "server-only";
import { and, eq, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { getDb } from "@/db";
import { documents, pages, posts, services, sessions, submissionFiles, submissions } from "@/db/schema";
import { audit } from "@/lib/audit";
import { TAGS } from "@/lib/content/queries";
import { processOutbox } from "@/lib/email/outbox";
import { logger } from "@/lib/security/logger";
import { purgeOldRateLimits } from "@/lib/security/rate-limit";
import { deleteObject } from "@/lib/storage";

// Background jobs, run by Vercel Cron through /api/cron/* (see vercel.json).
// Each is idempotent and safe to run more often than scheduled.

/** Scheduled content whose time has come becomes published. */
export async function publishScheduled(): Promise<number> {
  const db = await getDb();
  const now = new Date();
  let total = 0;
  const tables = [
    { table: posts, tag: TAGS.posts },
    { table: pages, tag: TAGS.pages },
    { table: services, tag: TAGS.services },
    { table: documents, tag: TAGS.documents },
  ] as const;
  for (const { table, tag } of tables) {
    const rows = await db
      .update(table)
      .set({ status: "published" })
      .where(and(eq(table.status, "scheduled"), lte(table.publishedAt, now)))
      .returning({ id: table.id });
    if (rows.length) {
      total += rows.length;
      revalidateTag(tag, "max");
      await audit({ userId: null, action: "content.scheduled_publish", entityType: tag, details: { count: rows.length } });
    }
  }
  if (total) {
    // Root-level routing and the sitemap depend on what's published.
    for (const t of [TAGS.posts, TAGS.pages, TAGS.documents, TAGS.services]) revalidateTag(t, "max");
  }
  return total;
}

/** Retention for client enquiries (days). Spam is kept 30 days. Set ENQUIRY_RETENTION_DAYS=0 to disable. */
export async function purgeExpired(): Promise<{ submissions: number; orphanFiles: number }> {
  const db = await getDb();
  const days = Number(process.env.ENQUIRY_RETENTION_DAYS ?? 0);
  let removed = 0;
  const spamCutoff = new Date(Date.now() - 30 * 86_400_000);
  const cutoff = days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
  const expired = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(cutoff ? sql`(${submissions.status} = 'spam' and ${submissions.createdAt} < ${spamCutoff}) or (${submissions.status} in ('completed','archived') and ${submissions.createdAt} < ${cutoff})` : and(eq(submissions.status, "spam"), lt(submissions.createdAt, spamCutoff)))
    .limit(200);
  if (expired.length) {
    const ids = expired.map((e) => e.id);
    const files = await db.select({ key: submissionFiles.key }).from(submissionFiles).where(inArray(submissionFiles.submissionId, ids));
    for (const f of files) await deleteObject("uploads", f.key).catch((err) => logger.warn("Delete upload failed", { err }));
    removed = (await db.delete(submissions).where(inArray(submissions.id, ids)).returning({ id: submissions.id })).length;
    await audit({ userId: null, action: "submission.retention_purge", entityType: "submission", details: { count: removed, files: files.length } });
  }
  // Uploads that were never attached to a submission (abandoned forms) after 2 days.
  const orphans = await db
    .select({ id: submissionFiles.id, key: submissionFiles.key })
    .from(submissionFiles)
    .where(and(isNull(submissionFiles.submissionId), lt(submissionFiles.createdAt, new Date(Date.now() - 2 * 86_400_000))))
    .limit(500);
  for (const o of orphans) await deleteObject("uploads", o.key).catch(() => undefined);
  if (orphans.length) await db.delete(submissionFiles).where(inArray(submissionFiles.id, orphans.map((o) => o.id)));
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date(Date.now() - 7 * 86_400_000)));
  await purgeOldRateLimits();
  return { submissions: removed, orphanFiles: orphans.length };
}

export async function sendDueEmails() {
  return processOutbox({ limit: 50 });
}
