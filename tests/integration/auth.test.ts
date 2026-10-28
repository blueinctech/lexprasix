import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { prepareTestDatabase } from "./setup";

let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
let s: typeof import("@/db/schema");
let auth: typeof import("@/lib/auth/service");
let tokens: typeof import("@/lib/auth/tokens");

const ctx = () => ({ ip: randomUUID(), ipHash: randomUUID().slice(0, 32), userAgent: "vitest", refererPath: null });
const PW = "a long memorable sentence";

beforeAll(async () => {
  await prepareTestDatabase();
  db = await (await import("@/db")).getDb();
  s = await import("@/db/schema");
  auth = await import("@/lib/auth/service");
  tokens = await import("@/lib/auth/tokens");
});

async function makeUser(password?: string) {
  const { hashPassword } = await import("@/lib/auth/password");
  const [u] = await db
    .insert(s.users)
    .values({ email: `user-${randomUUID()}@example.com`, name: "Test User", role: "editor", passwordHash: password ? await hashPassword(password) : null })
    .returning();
  return u;
}

const login = (email: string, password: string) => auth.loginWithPassword({ email, password, ctx: ctx() });

describe("staff sign-in", () => {
  it("signs in with the right password and creates a session", async () => {
    const u = await makeUser(PW);
    expect(await login(u.email, PW)).toEqual({ ok: true, redirectTo: "/admin/" });
    expect(await db.select().from(s.sessions).where(eq(s.sessions.userId, u.id))).toHaveLength(1);
  });

  it("gives the same answer for unknown emails and wrong passwords", async () => {
    const u = await makeUser(PW);
    expect(await login(u.email, "wrong password!!")).toEqual(await login(`nobody-${randomUUID()}@example.com`, "wrong password!!"));
  });

  it("locks the account after 5 failed attempts, even for the right password", async () => {
    const u = await makeUser(PW);
    for (let i = 0; i < 5; i++) await login(u.email, "wrong password!!");
    const res = await login(u.email, PW);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/locked/i);
  });

  it("does not sign in deactivated users", async () => {
    const u = await makeUser(PW);
    await db.update(s.users).set({ isActive: false }).where(eq(s.users.id, u.id));
    expect((await login(u.email, PW)).ok).toBe(false);
  });
});

describe("invitations and password resets", () => {
  it("an invite token sets the password once, then stops working", async () => {
    const u = await makeUser();
    const token = await tokens.issueToken(u.id, "invite", null);
    expect(await tokens.inspectToken("invite", token)).toMatchObject({ userId: u.id });
    expect((await auth.redeemToken({ purpose: "invite", token, password: "another long sentence", ctx: ctx() })).ok).toBe(true);
    expect((await auth.redeemToken({ purpose: "invite", token, password: "another long sentence", ctx: ctx() })).ok).toBe(false);
    expect((await login(u.email, "another long sentence")).ok).toBe(true);
  });

  it("a reset token cannot be used as an invitation", async () => {
    const u = await makeUser(PW);
    const token = await tokens.issueToken(u.id, "reset", null);
    expect((await auth.redeemToken({ purpose: "invite", token, password: "another long sentence", ctx: ctx() })).ok).toBe(false);
  });

  it("resetting the password revokes existing sessions", async () => {
    const u = await makeUser(PW);
    await login(u.email, PW);
    const token = await tokens.issueToken(u.id, "reset", null);
    await auth.redeemToken({ purpose: "reset", token, password: "brand new long sentence", ctx: ctx() });
    const active = (await db.select().from(s.sessions).where(eq(s.sessions.userId, u.id))).filter((x) => !x.revokedAt);
    expect(active).toHaveLength(1);
  });
});
