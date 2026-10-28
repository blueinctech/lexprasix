"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { authors, posts, userRole, users } from "@/db/schema";
import { adminAction, invalid } from "@/lib/admin/action";
import { refreshPublic, slugify } from "@/lib/admin/content";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { createResetLink, sendInvite } from "@/lib/auth/service";
import { revokeAllSessions } from "@/lib/auth/session";

const role = z.enum(userRole.enumValues, { error: "Choose a role" });
const optionalUuid = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.uuid().nullable());

/** Active administrators other than `exceptId`. */
async function otherActiveAdmins(exceptId: string): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "administrator"), eq(users.isActive, true), ne(users.id, exceptId)));
  return n;
}

export async function inviteUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (me) => {
    const parsed = z
      .object({
        name: z.string().trim().min(2, { error: "Enter the person's name" }).max(100),
        email: z.email({ error: "Enter a valid email" }).max(254).transform((v) => v.toLowerCase().trim()),
        role,
        authorId: optionalUuid,
      })
      .safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email));
    if (exists) return fail("A user with this email already exists.", { email: "Already a user" });
    const [user] = await db.insert(users).values({ ...parsed.data, invitedById: me.id }).returning({ id: users.id });
    const { link } = await sendInvite(user.id, { id: me.id, name: me.name });
    await audit({ userId: me.id, action: "user.invite", entityType: "user", entityId: user.id, details: { role: parsed.data.role } });
    return ok(`Invitation sent to ${parsed.data.email}. If it doesn't arrive, copy this one-time link and send it to them yourself (valid 7 days):`, { link, id: user.id });
  });
}

export async function updateUser(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (me) => {
    const parsed = z.object({ id: z.uuid(), name: z.string().trim().min(2).max(100), role, authorId: optionalUuid }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const { id, ...values } = parsed.data;
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return fail("User not found.");
    if (target.role === "administrator" && values.role !== "administrator") {
      if (id === me.id) return fail("You can't remove your own administrator role. Ask another administrator.");
      if (target.isActive && (await otherActiveAdmins(id)) === 0) return fail("This is the only active administrator. Make someone else an administrator first.");
    }
    await db.update(users).set(values).where(eq(users.id, id));
    if (values.role !== target.role) {
      // New permissions apply from a fresh sign-in.
      await revokeAllSessions(id);
      await audit({ userId: me.id, action: "user.role_change", entityType: "user", entityId: id, details: { from: target.role, to: values.role } });
    } else {
      await audit({ userId: me.id, action: "user.update", entityType: "user", entityId: id });
    }
    return ok(values.role !== target.role ? "Saved. They'll need to sign in again for the new role to apply." : "Saved.");
  });
}

export async function setUserActive(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (me) => {
    const id = String(fd.get("id") ?? "");
    const active = fd.get("active") === "yes";
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, id));
    if (!target) return fail("User not found.");
    if (!active) {
      if (id === me.id) return fail("You can't deactivate your own account.");
      if (target.role === "administrator" && (await otherActiveAdmins(id)) === 0) return fail("This is the only active administrator.");
    }
    await db.update(users).set({ isActive: active, ...(active ? { failedLoginAttempts: 0, lockedUntil: null } : {}) }).where(eq(users.id, id));
    if (!active) await revokeAllSessions(id);
    await audit({ userId: me.id, action: active ? "user.reactivate" : "user.deactivate", entityType: "user", entityId: id });
    return ok(active ? "Account reactivated." : "Account deactivated and signed out everywhere.");
  });
}

export async function resendInvite(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (me) => {
    const id = String(fd.get("id") ?? "");
    const db = await getDb();
    const [target] = await db.select({ isActive: users.isActive, email: users.email }).from(users).where(eq(users.id, id));
    if (!target?.isActive) return fail("Only active users can be invited.");
    const { link } = await sendInvite(id, { id: me.id, name: me.name });
    await audit({ userId: me.id, action: "user.invite_resend", entityType: "user", entityId: id });
    return ok(`New invitation sent to ${target.email}. Earlier links no longer work. One-time link:`, { link });
  });
}

export async function makeResetLink(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (me) => {
    const id = String(fd.get("id") ?? "");
    const db = await getDb();
    const [target] = await db.select({ isActive: users.isActive, passwordHash: users.passwordHash }).from(users).where(eq(users.id, id));
    if (!target?.isActive) return fail("Only active users can reset their password.");
    if (!target.passwordHash) return fail("This person hasn't accepted their invitation yet. Resend the invitation instead.");
    const link = await createResetLink(id, me.id);
    await audit({ userId: me.id, action: "user.reset_link", entityType: "user", entityId: id });
    return ok("Password reset link created. Give it to the person privately; it works once and expires in 60 minutes:", { link });
  });
}

export async function signOutEverywhere(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("users.manage", async (me) => {
    const id = String(fd.get("id") ?? "");
    await revokeAllSessions(id);
    await audit({ userId: me.id, action: "user.sessions_revoked", entityType: "user", entityId: id });
    if (id === me.id) redirect("/admin/login/");
    return ok("Signed out on all devices.");
  });
}

// ---------------------------------------------------------------- authors (public profiles)

const authorSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(2, { error: "Enter a name" }).max(100),
  slug: z
    .string()
    .trim()
    .max(90)
    .transform((v) => slugify(v)),
  role: z.string().trim().max(100),
  bio: z.string().trim().max(2000),
  photoId: optionalUuid,
  seoTitle: z.string().trim().max(120),
  seoDescription: z.string().trim().max(300),
});

export async function saveAuthor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("authors.manage", async (me) => {
    const parsed = authorSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const { id, seoTitle, seoDescription, ...rest } = parsed.data;
    const slug = rest.slug || slugify(rest.name);
    if (!slug) return fail("Enter a URL slug.", { slug: "Required" });
    const db = await getDb();
    const [clash] = await db.select({ id: authors.id }).from(authors).where(and(eq(authors.slug, slug), id ? ne(authors.id, id) : undefined));
    if (clash) return fail("Another author already uses this URL.", { slug: "Already in use" });
    let authorId = id;
    if (id) {
      const [current] = await db.select({ seo: authors.seo }).from(authors).where(eq(authors.id, id));
      if (!current) return fail("Author not found.");
      await db.update(authors).set({ ...rest, slug, seo: { ...current.seo, title: seoTitle || undefined, description: seoDescription || undefined } }).where(eq(authors.id, id));
    } else {
      const [row] = await db.insert(authors).values({ ...rest, slug, seo: { title: seoTitle || undefined, description: seoDescription || undefined } }).returning({ id: authors.id });
      authorId = row.id;
    }
    await audit({ userId: me.id, action: id ? "author.update" : "author.create", entityType: "author", entityId: authorId });
    refreshPublic("authors", "posts");
    if (!id) redirect(`/admin/users/authors/${authorId}/?created=1`);
    return ok("Author profile saved.");
  });
}

export async function deleteAuthor(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("authors.manage", async (me) => {
    const id = String(fd.get("id") ?? "");
    const db = await getDb();
    const [{ n }] = await db.select({ n: count() }).from(posts).where(eq(posts.authorId, id));
    if (n > 0) return fail(`This author has ${n} article(s). Reassign them before deleting the profile.`);
    await db.update(users).set({ authorId: null }).where(eq(users.authorId, id));
    await db.delete(authors).where(eq(authors.id, id));
    await audit({ userId: me.id, action: "author.delete", entityType: "author", entityId: id });
    refreshPublic("authors", "posts");
    redirect("/admin/users/authors/");
  });
}
