import "server-only";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db";
import { emailOutbox } from "@/db/schema";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/security/logger";
import { sendViaProvider } from "./provider";
import { renderTemplate, type TemplateName } from "./templates";

// Durable email: every message is first written to email_outbox (in the same
// transaction as the record it belongs to), then sent right after the response
// and retried by the cron job (/api/cron/outbox) with backoff. The unique
// idempotency key stops duplicates when a request or job is retried.

export type QueuedEmail = {
  idempotencyKey: string;
  template: TemplateName;
  to: string[];
  subject: string;
  replyTo?: string | null;
  payload: Record<string, unknown>;
  submissionId?: string | null;
  /** Payload contains a secret (sign-in link): wipe it once sent. */
  sensitive?: boolean;
};

const MAX_ATTEMPTS = 6;
const backoffMs = (attempt: number) => Math.min(6 * 60 * 60 * 1000, 60_000 * 2 ** attempt);

export async function enqueueEmails(items: QueuedEmail[], db?: DbOrTx): Promise<string[]> {
  if (!items.length) return [];
  const conn = db ?? (await getDb());
  const rows = await conn
    .insert(emailOutbox)
    .values(
      items.map((i) => ({
        idempotencyKey: i.idempotencyKey,
        template: i.template,
        to: i.to,
        subject: i.subject,
        replyTo: i.replyTo ?? null,
        payload: { ...i.payload, ...(i.sensitive ? { __sensitive: true } : {}) },
        submissionId: i.submissionId ?? null,
      })),
    )
    .onConflictDoNothing({ target: emailOutbox.idempotencyKey })
    .returning({ id: emailOutbox.id });
  return rows.map((r) => r.id);
}

/**
 * Send due messages. `ids` limits it to specific rows (used right after a form
 * submit); otherwise sends whatever is due (cron). Rows are claimed with a
 * conditional update so two workers never send the same message.
 */
export async function processOutbox(opts: { ids?: string[]; limit?: number } = {}): Promise<{ sent: number; failed: number }> {
  const db = await getDb();
  const now = new Date();
  // A row stuck in "sending" for 10+ minutes (function was killed) is retried.
  const stale = new Date(now.getTime() - 10 * 60 * 1000);
  const due = or(
    and(inArray(emailOutbox.status, ["pending", "failed"]), lte(emailOutbox.nextAttemptAt, now)),
    and(eq(emailOutbox.status, "sending"), lte(emailOutbox.updatedAt, stale)),
  );
  const candidates = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(opts.ids?.length ? and(inArray(emailOutbox.id, opts.ids), due) : and(due, sql`${emailOutbox.attempts} < ${MAX_ATTEMPTS}`))
    .orderBy(emailOutbox.createdAt)
    .limit(opts.limit ?? 25);

  let sent = 0;
  let failed = 0;
  for (const { id } of candidates) {
    const [row] = await db
      .update(emailOutbox)
      .set({ status: "sending", attempts: sql`${emailOutbox.attempts} + 1` })
      .where(and(eq(emailOutbox.id, id), due))
      .returning();
    if (!row) continue;
    try {
      const { html, text } = renderTemplate(row.template as TemplateName, row.payload);
      const result = await sendViaProvider({ to: row.to, subject: row.subject, html, text, replyTo: row.replyTo, idempotencyKey: row.idempotencyKey });
      if (result.ok) {
        sent++;
        await db
          .update(emailOutbox)
          .set({ status: "sent", sentAt: new Date(), providerMessageId: result.messageId, lastError: null, ...(row.payload.__sensitive ? { payload: { redacted: true } } : {}) })
          .where(eq(emailOutbox.id, id));
      } else {
        failed++;
        const giveUp = !result.retryable || row.attempts >= MAX_ATTEMPTS;
        await db
          .update(emailOutbox)
          .set({ status: "failed", lastError: result.error.slice(0, 500), nextAttemptAt: new Date(Date.now() + (giveUp ? 365 * 86_400_000 : backoffMs(row.attempts))) })
          .where(eq(emailOutbox.id, id));
      }
    } catch (err) {
      failed++;
      const message = err instanceof ConfigurationError ? err.message : "Unexpected error while sending";
      logger.error("Email send failed", { id, err });
      await db
        .update(emailOutbox)
        .set({ status: "failed", lastError: message, nextAttemptAt: new Date(Date.now() + backoffMs(row.attempts)) })
        .where(eq(emailOutbox.id, id));
    }
  }
  return { sent, failed };
}

/** Manual retry from the admin: make a failed message due now. */
export async function retryEmail(id: string): Promise<void> {
  const db = await getDb();
  await db.update(emailOutbox).set({ status: "pending", nextAttemptAt: new Date(), attempts: 0 }).where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, "failed")));
  await processOutbox({ ids: [id] });
}
