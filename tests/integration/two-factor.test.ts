import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { cookies } from "next/headers";
import { totp } from "@/lib/auth/totp";
import { prepareTestDatabase } from "./setup";

let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
let s: typeof import("@/db/schema");
let auth: typeof import("@/lib/auth/service");
let tf: typeof import("@/lib/auth/two-factor");
let tokens: typeof import("@/lib/auth/tokens");

const ctx = () => ({ ip: randomUUID(), ipHash: randomUUID().slice(0, 32), userAgent: "vitest", refererPath: null });
const PW = "a long memorable sentence";
const STEP = 30_000;

beforeAll(async () => {
  await prepareTestDatabase();
  db = await (await import("@/db")).getDb();
  s = await import("@/db/schema");
  auth = await import("@/lib/auth/service");
  tf = await import("@/lib/auth/two-factor");
  tokens = await import("@/lib/auth/tokens");
});

async function makeUser(role: "administrator" | "editor" = "editor") {
  const { hashPassword } = await import("@/lib/auth/password");
  const [u] = await db
    .insert(s.users)
    .values({ email: `user-${randomUUID()}@example.com`, name: "Test User", role, passwordHash: await hashPassword(PW) })
    .returning();
  return u;
}

/** Turns 2FA on through the real setup flow; returns the plaintext secret and recovery codes. */
async function enable(userId: string) {
  await tf.beginTwoFactorSetup(userId);
  const [row] = await db.select({ pending: s.users.totpPendingSecret }).from(s.users).where(eq(s.users.id, userId));
  const secret = tf.decryptSecret(row.pending!);
  const codes = await tf.confirmTwoFactorSetup(userId, totp(secret));
  expect(codes).toHaveLength(10);
  return { secret, codes: codes! };
}

const activeSessions = async (userId: string) => (await db.select().from(s.sessions).where(and(eq(s.sessions.userId, userId), isNull(s.sessions.revokedAt)))).length;
const login = (email: string) => auth.loginWithPassword({ email, password: PW, ctx: ctx() });
const verify = (code: string) => auth.verifyTwoFactorLogin({ code, ctx: ctx() });
/** A code for the next 30-second step (still inside the ±1 window, and newer than the last one used). */
const nextCode = (secret: string) => totp(secret, Date.now() + STEP);

describe("two-factor setup", () => {
  it("needs a correct code to turn on, and stores the secret encrypted", async () => {
    const u = await makeUser();
    await tf.beginTwoFactorSetup(u.id);
    expect((await tf.twoFactorStatus(u.id)).enabled).toBe(false);
    expect(await tf.confirmTwoFactorSetup(u.id, "000000")).toBeNull();
    await tf.cancelTwoFactorSetup(u.id);
    const { secret } = await enable(u.id);
    const [row] = await db.select().from(s.users).where(eq(s.users.id, u.id));
    expect(row.totpSecret).toMatch(/^v1\./);
    expect(row.totpSecret).not.toContain(secret);
    expect(row.totpPendingSecret).toBeNull();
    expect(row.recoveryCodes).toHaveLength(10);
    for (const h of row.recoveryCodes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await tf.twoFactorStatus(u.id)).toMatchObject({ enabled: true, recoveryCodesLeft: 10 });
  });

  it("rejects a code that was already used (replay)", async () => {
    const u = await makeUser();
    const { secret } = await enable(u.id);
    const code = nextCode(secret);
    expect(await tf.verifyTotpCode(u.id, code)).toBe(true);
    expect(await tf.verifyTotpCode(u.id, code)).toBe(false);
    // The current step's code is older than the one just used.
    expect(await tf.verifyTotpCode(u.id, totp(secret))).toBe(false);
  });

  it("accepts ±1 step but not 2 steps away", async () => {
    const u = await makeUser();
    const { secret } = await enable(u.id);
    const reset = () => db.update(s.users).set({ totpLastStep: null }).where(eq(s.users.id, u.id));
    await reset();
    expect(await tf.verifyTotpCode(u.id, totp(secret, Date.now() - STEP))).toBe(true);
    await reset();
    expect(await tf.verifyTotpCode(u.id, totp(secret, Date.now() + STEP))).toBe(true);
    await reset();
    expect(await tf.verifyTotpCode(u.id, totp(secret, Date.now() + 3 * STEP))).toBe(false);
  });
});

describe("sign-in with two-factor", () => {
  it("creates no session until the code is verified", async () => {
    const u = await makeUser();
    const { secret } = await enable(u.id);
    expect(await login(u.email)).toEqual({ ok: true, redirectTo: auth.VERIFY_PATH });
    expect(await activeSessions(u.id)).toBe(0);
    expect((await cookies()).get(tf.CHALLENGE_COOKIE)).toBeDefined();
    expect(await tf.hasActiveChallenge()).toBe(true);

    expect((await verify("123456")).ok).toBe(false);
    expect(await activeSessions(u.id)).toBe(0);

    const code = nextCode(secret);
    expect(await verify(`${code.slice(0, 3)} ${code.slice(3)}`)).toEqual({ ok: true, redirectTo: "/admin/" });
    expect(await activeSessions(u.id)).toBe(1);
    expect((await cookies()).get(tf.CHALLENGE_COOKIE)).toBeUndefined();
    // The challenge is single-use.
    expect((await verify(code)).ok).toBe(false);
  });

  it("keeps the requested admin page for after the code", async () => {
    const u = await makeUser();
    const { secret } = await enable(u.id);
    await auth.loginWithPassword({ email: u.email, password: PW, next: "/admin/posts/", ctx: ctx() });
    expect(await verify(nextCode(secret))).toEqual({ ok: true, redirectTo: "/admin/posts/" });
  });

  it("voids the challenge after 5 wrong codes", async () => {
    const u = await makeUser();
    const { secret } = await enable(u.id);
    await login(u.email);
    for (let i = 0; i < tf.MAX_CHALLENGE_ATTEMPTS; i++) expect((await verify("000000")).ok).toBe(false);
    const res = await verify(nextCode(secret));
    expect(res).toMatchObject({ ok: false, restart: true });
    expect(await activeSessions(u.id)).toBe(0);
  });

  it("recovery codes work once", async () => {
    const u = await makeUser();
    const { codes } = await enable(u.id);
    await login(u.email);
    expect((await verify(codes[0].toUpperCase())).ok).toBe(true);
    expect((await tf.twoFactorStatus(u.id)).recoveryCodesLeft).toBe(9);
    await login(u.email);
    expect((await verify(codes[0])).ok).toBe(false);
    expect((await verify(codes[1].replace("-", ""))).ok).toBe(true);
    expect((await tf.twoFactorStatus(u.id)).recoveryCodesLeft).toBe(8);
  });

  it("a password reset link does not bypass two-factor", async () => {
    const u = await makeUser();
    const { secret } = await enable(u.id);
    const token = await tokens.issueToken(u.id, "reset", null);
    expect(await auth.redeemToken({ purpose: "reset", token, password: "a brand new long sentence", ctx: ctx() })).toEqual({ ok: true, redirectTo: auth.VERIFY_PATH });
    expect(await activeSessions(u.id)).toBe(0);
    expect((await verify(nextCode(secret))).ok).toBe(true);
    expect(await activeSessions(u.id)).toBe(1);
  });

  it("users without two-factor still sign in directly", async () => {
    const u = await makeUser();
    expect(await login(u.email)).toEqual({ ok: true, redirectTo: "/admin/" });
    expect(await activeSessions(u.id)).toBe(1);
  });
});

describe("administrator reset", () => {
  it("clears two-factor and signs the user out", async () => {
    const { resetUserTwoFactor } = await import("@/app/admin/_actions/users");
    const target = await makeUser();
    await enable(target.id);
    // A session for the target (signed in via a recovery code).
    await db.insert(s.sessions).values({ userId: target.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3_600_000), idleExpiresAt: new Date(Date.now() + 3_600_000) });

    const admin = await makeUser("administrator");
    expect(await login(admin.email)).toEqual({ ok: true, redirectTo: "/admin/" });
    const fd = new FormData();
    fd.set("id", target.id);
    expect(await resetUserTwoFactor({ status: "idle" }, fd)).toMatchObject({ status: "ok" });

    const [row] = await db.select().from(s.users).where(eq(s.users.id, target.id));
    expect(row).toMatchObject({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] });
    expect(await activeSessions(target.id)).toBe(0);
    const [entry] = await db.select().from(s.auditLog).where(and(eq(s.auditLog.action, "user.2fa_reset"), eq(s.auditLog.entityId, target.id)));
    expect(entry?.userId).toBe(admin.id);

    // Not for your own account.
    const self = new FormData();
    self.set("id", admin.id);
    expect(await resetUserTwoFactor({ status: "idle" }, self)).toMatchObject({ status: "error", message: expect.stringContaining("My account") });

    expect(await login(target.email)).toEqual({ ok: true, redirectTo: "/admin/" });
  });
});
