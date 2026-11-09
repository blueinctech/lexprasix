import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import QRCode from "qrcode";
import { getDb } from "@/db";
import { twoFactorChallenges, users } from "@/db/schema";
import { isDev, authSecret } from "@/lib/env";
import { generateToken, hmac, sha256 } from "@/lib/security/crypto";
import { generateRecoveryCodes, generateTotpSecret, groupSecret, matchTotp, normalizeRecoveryCode, normalizeTotpCode, otpauthUri } from "./totp";

/**
 * Two-factor authentication: TOTP secrets (AES-256-GCM encrypted with a key
 * derived from AUTH_SECRET), single-use recovery codes (stored as keyed
 * hashes), and the short-lived challenge between password and code at sign-in.
 */

export const TOTP_ISSUER = "LexPraxis Admin";
export const CHALLENGE_COOKIE = "lp_2fa";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_CHALLENGE_ATTEMPTS = 5;

// ---------------------------------------------------------------- secret encryption

function encryptionKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", authSecret(), "lexpraxis-totp", "totp-secret-v1", 32));
}

/** "v1.iv.tag.ciphertext" (base64url parts). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, ct] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

const recoveryHash = (userId: string, normalized: string) => hmac("recovery-code", userId, normalized);

// ---------------------------------------------------------------- status and setup

export type TwoFactorStatus = { enabled: boolean; enabledAt: Date | null; recoveryCodesLeft: number; pending: boolean };

export async function twoFactorStatus(userId: string): Promise<TwoFactorStatus> {
  const db = await getDb();
  const [row] = await db
    .select({ enabledAt: users.totpEnabledAt, secret: users.totpSecret, pending: users.totpPendingSecret, codes: users.recoveryCodes })
    .from(users)
    .where(eq(users.id, userId));
  const enabled = Boolean(row?.enabledAt && row.secret);
  return { enabled, enabledAt: enabled ? row!.enabledAt : null, recoveryCodesLeft: enabled ? row!.codes.length : 0, pending: !enabled && Boolean(row?.pending) };
}

/** Start (or restart) setup: a new pending secret that does nothing until confirmed. */
export async function beginTwoFactorSetup(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ totpPendingSecret: encryptSecret(generateTotpSecret()) }).where(and(eq(users.id, userId), isNull(users.totpEnabledAt)));
}

export async function cancelTwoFactorSetup(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ totpPendingSecret: null }).where(eq(users.id, userId));
}

/** What the setup screen shows: QR code (SVG data URL) and the key for manual entry. */
export async function pendingSetup(user: { id: string; email: string }): Promise<{ qr: string; key: string } | null> {
  const db = await getDb();
  const [row] = await db.select({ pending: users.totpPendingSecret, enabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, user.id));
  if (!row?.pending || row.enabledAt) return null;
  const secret = decryptSecret(row.pending);
  const svg = await QRCode.toString(otpauthUri({ secret, account: user.email, issuer: TOTP_ISSUER }), { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, key: groupSecret(secret) };
}

async function storeRecoveryCodes(userId: string): Promise<string[]> {
  const codes = generateRecoveryCodes();
  const db = await getDb();
  await db
    .update(users)
    .set({ recoveryCodes: codes.map((c) => recoveryHash(userId, normalizeRecoveryCode(c)!)) })
    .where(eq(users.id, userId));
  return codes;
}

/** Confirms setup with a code from the app. Returns the new recovery codes (shown once), or null. */
export async function confirmTwoFactorSetup(userId: string, code: string): Promise<string[] | null> {
  const db = await getDb();
  const [row] = await db.select({ pending: users.totpPendingSecret, enabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, userId));
  if (!row?.pending || row.enabledAt) return null;
  const step = matchTotp(decryptSecret(row.pending), code);
  if (step === null) return null;
  const [done] = await db
    .update(users)
    .set({ totpSecret: row.pending, totpPendingSecret: null, totpEnabledAt: new Date(), totpLastStep: step })
    .where(and(eq(users.id, userId), eq(users.totpPendingSecret, row.pending), isNull(users.totpEnabledAt)))
    .returning({ id: users.id });
  if (!done) return null;
  return storeRecoveryCodes(userId);
}

export async function regenerateRecoveryCodes(userId: string): Promise<string[]> {
  return storeRecoveryCodes(userId);
}

/** Turns 2FA off (by the user, or an administrator's reset) and voids pending sign-in challenges. */
export async function clearTwoFactor(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] }).where(eq(users.id, userId));
  await db.update(twoFactorChallenges).set({ consumedAt: new Date() }).where(and(eq(twoFactorChallenges.userId, userId), isNull(twoFactorChallenges.consumedAt)));
}

// ---------------------------------------------------------------- verification

/** Checks a TOTP code and records its step, so the same code can't be used twice. */
export async function verifyTotpCode(userId: string, code: string): Promise<boolean> {
  if (!normalizeTotpCode(code)) return false;
  const db = await getDb();
  const [row] = await db.select({ secret: users.totpSecret, enabledAt: users.totpEnabledAt }).from(users).where(eq(users.id, userId));
  if (!row?.secret || !row.enabledAt) return false;
  const step = matchTotp(decryptSecret(row.secret), code);
  if (step === null) return false;
  // Conditional update: a concurrent request with the same code loses.
  const [ok] = await db
    .update(users)
    .set({ totpLastStep: step })
    .where(and(eq(users.id, userId), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
    .returning({ id: users.id });
  return Boolean(ok);
}

/** Uses up a recovery code. True only the first time a valid code is presented. */
export async function consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) return false;
  const hash = recoveryHash(userId, normalized);
  const db = await getDb();
  const [ok] = await db
    .update(users)
    .set({ recoveryCodes: sql`${users.recoveryCodes} - ${hash}::text` })
    .where(and(eq(users.id, userId), sql`${users.totpEnabledAt} is not null`, sql`jsonb_exists(${users.recoveryCodes}, ${hash}::text)`))
    .returning({ id: users.id });
  return Boolean(ok);
}

/** TOTP code or (when allowed) a recovery code. Returns which one worked. */
export async function verifySecondFactor(userId: string, code: string, allowRecovery = true): Promise<"totp" | "recovery" | null> {
  if (normalizeTotpCode(code)) return (await verifyTotpCode(userId, code)) ? "totp" : null;
  if (allowRecovery && (await consumeRecoveryCode(userId, code))) return "recovery";
  return null;
}

// ---------------------------------------------------------------- sign-in challenge

/** After a correct password (or reset link) for a 2FA account: remember who is signing in for 5 minutes. */
export async function createChallenge(userId: string, next: string | null): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  const db = await getDb();
  await db.insert(twoFactorChallenges).values({ userId, tokenHash: sha256(token), next, expiresAt });
  (await cookies()).set(CHALLENGE_COOKIE, token, { httpOnly: true, secure: !isDev, sameSite: "lax", path: "/admin", expires: expiresAt });
}

async function challengeToken(): Promise<string | null> {
  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  return token && token.length >= 32 && token.length <= 128 ? token : null;
}

/** For the verify page: is there a live challenge? */
export async function hasActiveChallenge(): Promise<boolean> {
  const token = await challengeToken();
  if (!token) return false;
  const db = await getDb();
  const [row] = await db
    .select({ id: twoFactorChallenges.id })
    .from(twoFactorChallenges)
    .where(and(eq(twoFactorChallenges.tokenHash, sha256(token)), isNull(twoFactorChallenges.consumedAt), gt(twoFactorChallenges.expiresAt, new Date()), lt(twoFactorChallenges.attempts, MAX_CHALLENGE_ATTEMPTS)))
    .limit(1);
  return Boolean(row);
}

/** Counts an attempt against the challenge in the cookie. Null when it's missing, used, expired or out of attempts. */
export async function takeChallengeAttempt(): Promise<{ id: string; userId: string; next: string | null; attemptsLeft: number } | null> {
  const token = await challengeToken();
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .update(twoFactorChallenges)
    .set({ attempts: sql`${twoFactorChallenges.attempts} + 1` })
    .where(and(eq(twoFactorChallenges.tokenHash, sha256(token)), isNull(twoFactorChallenges.consumedAt), gt(twoFactorChallenges.expiresAt, new Date()), lt(twoFactorChallenges.attempts, MAX_CHALLENGE_ATTEMPTS)))
    .returning({ id: twoFactorChallenges.id, userId: twoFactorChallenges.userId, next: twoFactorChallenges.next, attempts: twoFactorChallenges.attempts });
  return row ? { id: row.id, userId: row.userId, next: row.next, attemptsLeft: MAX_CHALLENGE_ATTEMPTS - row.attempts } : null;
}

/** Marks the challenge used (true only for the first caller) and clears the cookie. */
export async function endChallenge(id: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .update(twoFactorChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(twoFactorChallenges.id, id), isNull(twoFactorChallenges.consumedAt)))
    .returning({ id: twoFactorChallenges.id });
  await clearChallengeCookie();
  return Boolean(row);
}

export async function clearChallengeCookie(): Promise<void> {
  (await cookies()).delete({ name: CHALLENGE_COOKIE, path: "/admin" });
}
