import "server-only";
import { getDb, type DbOrTx } from "@/db";
import { auditLog } from "@/db/schema";
import { logger } from "@/lib/security/logger";

/**
 * Records a sensitive action. Never put passwords, tokens or client-supplied
 * form values in `details` — ids, titles and field names only.
 * Failures are logged but never block the action itself.
 */
export async function audit(
  entry: { userId: string | null; action: string; entityType?: string; entityId?: string; details?: Record<string, unknown>; ipHash?: string | null },
  db?: DbOrTx,
): Promise<void> {
  try {
    const conn = db ?? (await getDb());
    await conn.insert(auditLog).values({
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      details: entry.details ?? {},
      ipHash: entry.ipHash ?? null,
    });
  } catch (err) {
    logger.error("Audit log write failed", { action: entry.action, err });
  }
}
