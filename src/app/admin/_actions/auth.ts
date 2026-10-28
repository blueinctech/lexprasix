"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { invalid } from "@/lib/admin/action";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current";
import { newPasswordSchema } from "@/lib/auth/password";
import { loginWithPassword, redeemToken, requestPasswordReset } from "@/lib/auth/service";
import { destroySession } from "@/lib/auth/session";
import { getRequestContext } from "@/lib/security/request";

const email = z
  .email({ error: "Enter a valid email address" })
  .max(254)
  .transform((v) => v.toLowerCase().trim());

export async function login(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email, password: z.string().min(1, { error: "Enter your password" }).max(200), next: z.string().max(300).optional() }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);
  const result = await loginWithPassword({ ...parsed.data, ctx: await getRequestContext() });
  if (!result.ok) return fail(result.error);
  redirect(result.redirectTo);
}

export async function forgotPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ email }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);
  const result = await requestPasswordReset({ email: parsed.data.email, ctx: await getRequestContext() });
  if (!result.ok) return fail(result.error);
  return ok("If that email belongs to an active account, we've sent a link to reset the password. It expires in 60 minutes.");
}

export async function setPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ purpose: z.enum(["invite", "reset"]), token: z.string().min(32).max(128), password: newPasswordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { error: "The passwords don't match", path: ["confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return invalid(parsed.error);
  const result = await redeemToken({ ...parsed.data, ctx: await getRequestContext() });
  if (!result.ok) return fail(result.error);
  redirect(result.redirectTo);
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit({ userId: user.id, action: "auth.logout", entityType: "user", entityId: user.id });
  redirect("/admin/login/");
}
