"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { adminAction, invalid } from "@/lib/admin/action";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/auth/password";
import { revokeOtherSessions } from "@/lib/auth/session";
import { beginTwoFactorSetup, cancelTwoFactorSetup, clearTwoFactor, confirmTwoFactorSetup, regenerateRecoveryCodes, verifySecondFactor, verifyTotpCode } from "@/lib/auth/two-factor";
import { rateLimit } from "@/lib/security/rate-limit";
import { getRequestContext } from "@/lib/security/request";

// "My account": every signed-in user manages their own password and 2FA here.
// Each check of a password or code counts against a per-user limit.

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const BAD_CODE = "That code didn't work. Check your authenticator app and try again.";
const code = z.string().trim().min(6, { error: "Enter the code" }).max(20);

async function limited(userId: string) {
  return !(await rateLimit("accountVerifyByUser", userId)).success;
}

async function passwordMatches(userId: string, password: string) {
  const db = await getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  return Boolean(row?.hash) && (await verifyPassword(password, row!.hash!));
}

export async function startTwoFactorSetup(): Promise<ActionState> {
  return adminAction("dashboard.view", async (me) => {
    await beginTwoFactorSetup(me.id);
    return ok("");
  });
}

export async function cancelTwoFactorSetupAction(): Promise<ActionState> {
  return adminAction("dashboard.view", async (me) => {
    await cancelTwoFactorSetup(me.id);
    return ok("");
  });
}

export async function confirmTwoFactor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("dashboard.view", async (me) => {
    const parsed = z.object({ code }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    if (await limited(me.id)) return fail(TOO_MANY);
    const codes = await confirmTwoFactorSetup(me.id, parsed.data.code);
    if (!codes) return fail(BAD_CODE, { code: "Incorrect code" });
    await audit({ userId: me.id, action: "auth.2fa_enabled", entityType: "user", entityId: me.id, ipHash: (await getRequestContext()).ipHash });
    return ok("Two-factor authentication is on.", { codes: codes.join(" ") });
  });
}

export async function regenerateRecoveryCodesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("dashboard.view", async (me) => {
    const parsed = z.object({ code }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    if (await limited(me.id)) return fail(TOO_MANY);
    if (!(await verifyTotpCode(me.id, parsed.data.code))) return fail(BAD_CODE, { code: "Incorrect code" });
    const codes = await regenerateRecoveryCodes(me.id);
    await audit({ userId: me.id, action: "auth.recovery_regenerated", entityType: "user", entityId: me.id, ipHash: (await getRequestContext()).ipHash });
    return ok("New recovery codes created. The old ones no longer work.", { codes: codes.join(" ") });
  });
}

export async function disableTwoFactor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("dashboard.view", async (me) => {
    const parsed = z.object({ password: z.string().min(1, { error: "Enter your password" }).max(200), code }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    if (await limited(me.id)) return fail(TOO_MANY);
    if (!(await passwordMatches(me.id, parsed.data.password))) return fail("Your password is incorrect.", { password: "Incorrect password" });
    if (!(await verifySecondFactor(me.id, parsed.data.code))) return fail("That code didn't work. Enter a code from your app or one of your recovery codes.", { code: "Incorrect code" });
    await clearTwoFactor(me.id);
    await audit({ userId: me.id, action: "auth.2fa_disabled", entityType: "user", entityId: me.id, ipHash: (await getRequestContext()).ipHash });
    return ok("Two-factor authentication is off.");
  });
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("dashboard.view", async (me) => {
    const parsed = z
      .object({ current: z.string().min(1, { error: "Enter your current password" }).max(200), password: newPasswordSchema, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { error: "The passwords don't match", path: ["confirm"] })
      .safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    if (await limited(me.id)) return fail(TOO_MANY);
    if (!(await passwordMatches(me.id, parsed.data.current))) return fail("Your current password is incorrect.", { current: "Incorrect password" });
    const db = await getDb();
    await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password), passwordUpdatedAt: new Date() }).where(eq(users.id, me.id));
    await revokeOtherSessions(me.id, me.sessionId);
    await audit({ userId: me.id, action: "auth.password_changed", entityType: "user", entityId: me.id, ipHash: (await getRequestContext()).ipHash });
    return ok("Password changed. You've been signed out on your other devices.");
  });
}
