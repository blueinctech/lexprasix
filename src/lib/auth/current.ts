import "server-only";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getDb } from "@/db";
import { users, type UserRole } from "@/db/schema";
import { hasDatabase } from "@/lib/env";
import { can, type Permission } from "./permissions";
import { readSession } from "./session";

// Data access layer for staff identity. Every admin page calls requireUserPage()
// and every admin Server Action calls requireUser(), so authorisation never
// depends on the proxy's optimistic cookie check.

export type CurrentUser = { id: string; email: string; name: string; role: UserRole; authorId: string | null; sessionId: string };

export class AuthError extends Error {
  constructor(public readonly code: "unauthenticated" | "forbidden") {
    super(code === "unauthenticated" ? "Your session has expired. Please sign in again." : "You don't have permission to do that.");
    this.name = "AuthError";
  }
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!hasDatabase()) return null;
  const session = await readSession();
  if (!session) return null;
  const db = await getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, authorId: users.authorId })
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.isActive, true)))
    .limit(1);
  return user ? { ...user, sessionId: session.sessionId } : null;
});

/** For pages: redirect to sign-in without a session, to the dashboard without the permission. */
export async function requireUserPage(permission: Permission = "dashboard.view"): Promise<CurrentUser> {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login/");
  if (!can(user.role, permission)) redirect("/admin/?denied=1");
  return user;
}

/** For Server Actions and route handlers: throws AuthError instead of redirecting. */
export async function requireUser(permission: Permission = "dashboard.view"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("unauthenticated");
  if (!can(user.role, permission)) throw new AuthError("forbidden");
  return user;
}
