import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db";
import { authTokens, users } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { generateToken, sha256 } from "@/lib/security/crypto";

/**
 * Invitation and password-reset tokens: 256-bit random, stored as SHA-256,
 * single-use and short-lived. Issuing a new token of the same purpose
 * invalidates earlier unused ones.
 */

export type TokenPurpose = "invite" | "reset";

export const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  invite: 7 * 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

export async function issueToken(userId: string, purpose: TokenPurpose, createdById: string | null, db?: DbOrTx): Promise<string> {
  const conn = db ?? (await getDb());
  const token = generateToken();
  const now = new Date();
  await conn
    .update(authTokens)
    .set({ consumedAt: now })
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose), isNull(authTokens.consumedAt)));
  await conn.insert(authTokens).values({ userId, purpose, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]), createdById });
  return token;
}

const plausible = (token: string) => token.length >= 32 && token.length <= 128;

function validToken(purpose: TokenPurpose, token: string) {
  return and(eq(authTokens.tokenHash, sha256(token)), eq(authTokens.purpose, purpose), isNull(authTokens.consumedAt), gt(authTokens.expiresAt, new Date()));
}

/** Look a token up without consuming it (to render the set-password page). */
export async function inspectToken(purpose: TokenPurpose, token: string) {
  if (!plausible(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ userId: users.id, email: users.email, name: users.name, isActive: users.isActive })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(validToken(purpose, token))
    .limit(1);
  return row?.isActive ? { userId: row.userId, email: row.email, name: row.name } : null;
}

/** Atomically consume a token; returns the user id, or null if invalid, used or expired. */
export async function consumeToken(purpose: TokenPurpose, token: string, db: DbOrTx): Promise<string | null> {
  if (!plausible(token)) return null;
  const [row] = await db.update(authTokens).set({ consumedAt: new Date() }).where(validToken(purpose, token)).returning({ userId: authTokens.userId });
  return row?.userId ?? null;
}

export function tokenLink(purpose: TokenPurpose, token: string): string {
  const page = purpose === "invite" ? "accept-invite" : "reset-password";
  return `${appUrl()}/admin/${page}/?token=${encodeURIComponent(token)}`;
}
