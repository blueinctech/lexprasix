import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { isDev } from "@/lib/env";
import { generateToken, sha256 } from "@/lib/security/crypto";
import type { RequestContext } from "@/lib/security/request";

/**
 * Database-backed staff sessions. The browser holds a random 256-bit token in
 * an HTTP-only cookie scoped to /admin; only its SHA-256 hash is stored.
 * Sessions have an absolute lifetime and a sliding idle timeout.
 */

export const SESSION_COOKIE = "lp_session";
const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const IDLE_MS = 2 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type ActiveSession = { sessionId: string; userId: string };

export async function createSession(userId: string, ctx: RequestContext): Promise<void> {
  const token = generateToken();
  const now = Date.now();
  const expiresAt = new Date(now + ABSOLUTE_MS);
  const db = await getDb();
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256(token),
    expiresAt,
    idleExpiresAt: new Date(now + IDLE_MS),
    ipHash: ctx.ipHash,
    userAgent: ctx.userAgent,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !isDev,
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
}

/** Validates the session cookie against the DB. Null when missing, expired or revoked. */
export async function readSession(): Promise<ActiveSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32 || token.length > 128) return null;
  const now = new Date();
  const db = await getDb();
  const [row] = await db
    .select({ id: sessions.id, userId: sessions.userId, expiresAt: sessions.expiresAt, idleExpiresAt: sessions.idleExpiresAt })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, sha256(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, now), gt(sessions.idleExpiresAt, now)))
    .limit(1);
  if (!row) return null;
  const nextIdle = new Date(Math.min(now.getTime() + IDLE_MS, row.expiresAt.getTime()));
  if (nextIdle.getTime() - row.idleExpiresAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ idleExpiresAt: nextIdle }).where(eq(sessions.id, row.id));
  }
  return { sessionId: row.id, userId: row.userId };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete({ name: SESSION_COOKIE, path: "/admin" });
}

/** Revoke every session for a user (deactivated, role change, or password reset). */
export async function revokeAllSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
