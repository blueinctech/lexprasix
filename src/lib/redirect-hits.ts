import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { redirects } from "@/db/schema";

/** Counts a use of an admin-managed redirect (shown on Admin → Redirects). Never throws. */
export async function recordRedirectHit(source: string): Promise<void> {
  try {
    const db = await getDb();
    await db.update(redirects).set({ hits: sql`${redirects.hits} + 1`, lastHitAt: new Date() }).where(eq(redirects.source, source));
  } catch {
    /* counting is best-effort */
  }
}
