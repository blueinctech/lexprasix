import "server-only";
import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { enqueueEmails, processOutbox } from "@/lib/email/outbox";
import { hmac } from "@/lib/security/crypto";
import { logger } from "@/lib/security/logger";
import { rateLimitAll } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password";
import { ROLE_LABELS } from "./permissions";
import { createSession, revokeAllSessions } from "./session";
import { consumeToken, issueToken, tokenLink, type TokenPurpose } from "./tokens";
import { createChallenge, endChallenge, takeChallengeAttempt, verifySecondFactor } from "./two-factor";

export type AuthResult = { ok: true; redirectTo: string } | { ok: false; error: string };
export type PlainResult = { ok: true } | { ok: false; error: string };

export const MAX_FAILED_LOGINS = 10;
export const LOCKOUT_MS = 15 * 60 * 1000;
const HOME = "/admin/";
export const VERIFY_PATH = "/admin/login/verify/";
const INVALID = "Incorrect email or password.";

const safeNext = (next: string | null | undefined) => (next && next.startsWith("/admin/") && !next.startsWith("//") && !next.includes("\\") ? next : HOME);
const hasTwoFactor = (u: { totpEnabledAt: Date | null; totpSecret: string | null }) => Boolean(u.totpEnabledAt && u.totpSecret);

const emailKey = (email: string) => hmac("rl-email", email).slice(0, 32);

async function findByEmail(email: string) {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return row ?? null;
}

export async function loginWithPassword(opts: { email: string; password: string; next?: string | null; ctx: RequestContext }): Promise<AuthResult> {
  const email = opts.email.toLowerCase();
  const { password, ctx } = opts;
  const limited = await rateLimitAll([
    ["loginByEmail", `${emailKey(email)}:${ctx.ipHash ?? "unknown"}`],
    ["loginByEmailAll", emailKey(email)],
    ["loginByIp", ctx.ipHash ?? "unknown"],
  ]);
  if (!limited.success) return { ok: false, error: "Too many sign-in attempts. Please wait a few minutes and try again." };

  const user = await findByEmail(email);
  if (!user || !user.isActive || !user.passwordHash) {
    await verifyAgainstDummy(password);
    return { ok: false, error: INVALID };
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await verifyAgainstDummy(password);
    // Same answer as a wrong password, so the lock doesn't reveal that the account exists.
    return { ok: false, error: INVALID };
  }
  const db = await getDb();
  if (!(await verifyPassword(password, user.passwordHash))) {
    const [row] = await db
      .update(users)
      .set({ failedLoginAttempts: sql`${users.failedLoginAttempts} + 1` })
      .where(eq(users.id, user.id))
      .returning({ n: users.failedLoginAttempts });
    if ((row?.n ?? 0) >= MAX_FAILED_LOGINS) {
      await db.update(users).set({ lockedUntil: new Date(Date.now() + LOCKOUT_MS), failedLoginAttempts: 0 }).where(eq(users.id, user.id));
      await audit({ userId: user.id, action: "auth.locked", entityType: "user", entityId: user.id, ipHash: ctx.ipHash });
    }
    return { ok: false, error: INVALID };
  }

  if (hasTwoFactor(user)) {
    // Password was right; no session until the second factor is checked.
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
    await createChallenge(user.id, safeNext(opts.next));
    return { ok: true, redirectTo: VERIFY_PATH };
  }
  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, ctx);
  await audit({ userId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ipHash: ctx.ipHash });
  return { ok: true, redirectTo: safeNext(opts.next) };
}

const CHALLENGE_GONE = "This sign-in has expired or had too many attempts. Please sign in again.";

/** Second sign-in step: a TOTP code (or a recovery code) for the challenge in the cookie. */
export async function verifyTwoFactorLogin(opts: { code: string; ctx: RequestContext }): Promise<AuthResult & { restart?: boolean }> {
  const { ctx } = opts;
  const challenge = await takeChallengeAttempt();
  if (!challenge) return { ok: false, error: CHALLENGE_GONE, restart: true };
  const limited = await rateLimitAll([
    ["twoFactorByUser", challenge.userId],
    ["twoFactorByIp", ctx.ipHash ?? "unknown"],
  ]);
  if (!limited.success) return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };

  const db = await getDb();
  const [user] = await db.select({ isActive: users.isActive, lockedUntil: users.lockedUntil }).from(users).where(eq(users.id, challenge.userId));
  const method = user?.isActive && !(user.lockedUntil && user.lockedUntil.getTime() > Date.now()) ? await verifySecondFactor(challenge.userId, opts.code) : null;
  if (!method) {
    await audit({ userId: challenge.userId, action: "auth.2fa_failed", entityType: "user", entityId: challenge.userId, ipHash: ctx.ipHash });
    if (challenge.attemptsLeft <= 0) {
      await endChallenge(challenge.id);
      return { ok: false, error: CHALLENGE_GONE, restart: true };
    }
    return { ok: false, error: "That code didn't work. Check your authenticator app and try again." };
  }
  if (!(await endChallenge(challenge.id))) return { ok: false, error: CHALLENGE_GONE, restart: true };
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, challenge.userId));
  await createSession(challenge.userId, ctx);
  await audit({ userId: challenge.userId, action: "auth.login", entityType: "user", entityId: challenge.userId, details: { method }, ipHash: ctx.ipHash });
  return { ok: true, redirectTo: safeNext(challenge.next) };
}

/** Queue an invitation email (new users, or users who never set a password). Returns the link for the inviter to copy if email is down. */
export async function sendInvite(userId: string, invitedBy: { id: string; name: string }): Promise<{ link: string }> {
  const db = await getDb();
  const [target] = await db.select({ email: users.email, name: users.name, role: users.role }).from(users).where(eq(users.id, userId));
  if (!target) throw new Error("User not found");
  const token = await issueToken(userId, "invite", invitedBy.id);
  const link = tokenLink("invite", token);
  const ids = await enqueueEmails([
    {
      idempotencyKey: `invite:${userId}:${token.slice(0, 12)}`,
      template: "auth.invite",
      to: [target.email],
      subject: "You're invited to the LexPraxis website admin",
      payload: { name: target.name, inviter: invitedBy.name, role: ROLE_LABELS[target.role], link },
      sensitive: true,
    },
  ]);
  after(() => processOutbox({ ids }));
  return { link };
}

/** "Forgot password". Always reports success so it can't be used to discover accounts. */
export async function requestPasswordReset(opts: { email: string; ctx: RequestContext }): Promise<PlainResult> {
  const email = opts.email.toLowerCase();
  const limited = await rateLimitAll([
    ["passwordResetByEmail", `${emailKey(email)}:${opts.ctx.ipHash ?? "unknown"}`],
    ["passwordResetByEmailAll", emailKey(email)],
    ["passwordResetByIp", opts.ctx.ipHash ?? "unknown"],
  ]);
  if (!limited.success) return { ok: false, error: "Too many requests. Please wait a while and try again." };

  // Look up and send after responding so timing doesn't reveal which emails exist.
  after(async () => {
    try {
      const user = await findByEmail(email);
      if (!user || !user.isActive) return;
      if (!user.passwordHash) {
        await sendInvite(user.id, { id: user.invitedById ?? user.id, name: "An administrator" });
        return;
      }
      const token = await issueToken(user.id, "reset", null);
      const ids = await enqueueEmails([
        {
          idempotencyKey: `reset:${user.id}:${token.slice(0, 12)}`,
          template: "auth.reset",
          to: [user.email],
          subject: "Reset your LexPraxis admin password",
          payload: { name: user.name, link: tokenLink("reset", token) },
          sensitive: true,
        },
      ]);
      await processOutbox({ ids });
    } catch (err) {
      logger.error("Password reset request failed", { err });
    }
  });
  return { ok: true };
}

/** Create a reset link on an administrator's behalf (shown to them to pass on). */
export async function createResetLink(userId: string, createdById: string): Promise<string> {
  return tokenLink("reset", await issueToken(userId, "reset", createdById));
}

/** Complete a reset or accept an invitation: set the password and sign in. */
export async function redeemToken(opts: { purpose: TokenPurpose; token: string; password: string; ctx: RequestContext }): Promise<AuthResult> {
  const limited = await rateLimitAll([["tokenRedeemByIp", opts.ctx.ipHash ?? "unknown"]]);
  if (!limited.success) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const passwordHash = await hashPassword(opts.password);
  const db = await getDb();
  const userId = await db.transaction(async (tx) => {
    const id = await consumeToken(opts.purpose, opts.token, tx);
    if (!id) return null;
    // Never set a password on a deactivated account (a link issued before deactivation).
    const [target] = await tx.select({ isActive: users.isActive }).from(users).where(eq(users.id, id));
    if (!target?.isActive) return null;
    await tx.update(users).set({ passwordHash, passwordUpdatedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, id));
    return id;
  });
  const [user] = userId ? await db.select().from(users).where(eq(users.id, userId)) : [];
  if (!user?.isActive) {
    return {
      ok: false,
      error: opts.purpose === "invite" ? "This invitation is invalid or has expired. Ask an administrator to send a new one." : "This reset link is invalid or has expired. Please request a new one.",
    };
  }
  // End every existing session (possibly an attacker's), then sign in fresh.
  await revokeAllSessions(user.id);
  await audit({ userId: user.id, action: opts.purpose === "invite" ? "auth.invite_accepted" : "auth.password_reset", entityType: "user", entityId: user.id, ipHash: opts.ctx.ipHash });
  // A reset link proves access to the mailbox only; 2FA accounts still need their code.
  if (hasTwoFactor(user)) {
    await createChallenge(user.id, HOME);
    return { ok: true, redirectTo: VERIFY_PATH };
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, opts.ctx);
  return { ok: true, redirectTo: HOME };
}
