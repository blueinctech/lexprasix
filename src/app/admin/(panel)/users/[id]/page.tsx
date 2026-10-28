import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, count, desc, eq, gt, isNull } from "drizzle-orm";
import { EditUserForm, UserAccessActions } from "@/components/admin/UserForms";
import { Badge, Card, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { auditLog, authors, sessions, users } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUserPage("users.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) notFound();
  const now = new Date();
  const [authorList, [{ n: sessionCount }], recent] = await Promise.all([
    db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
    db.select({ n: count() }).from(sessions).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt), gt(sessions.expiresAt, now), gt(sessions.idleExpiresAt, now))),
    db.select({ action: auditLog.action, createdAt: auditLog.createdAt }).from(auditLog).where(eq(auditLog.userId, id)).orderBy(desc(auditLog.createdAt)).limit(10),
  ]);
  const isSelf = id === me.id;
  return (
    <>
      <PageTitle title={user.name} description={user.email} back={{ href: "/admin/users/", label: "Users" }} actions={<Badge value={user.role} label={ROLE_LABELS[user.role]} />} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Card title="Profile and role">
            <EditUserForm user={{ id: user.id, name: user.name, role: user.role, authorId: user.authorId }} authors={authorList.map((a) => ({ value: a.id, label: a.name }))} isSelf={isSelf} />
          </Card>
          <Card title="Recent activity" padded={false}>
            {recent.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {recent.map((r, i) => (
                  <li key={i} className="flex justify-between gap-4 px-5 py-2.5">
                    <span className="text-slate-700">{r.action.replace(/[._]/g, " ")}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-5 text-sm text-slate-500">No recorded activity yet.</p>
            )}
          </Card>
        </div>
        <Card title="Access">
          <dl className="mb-5 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd>{user.isActive ? (user.passwordHash ? "Active" : "Invited") : "Deactivated"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Last sign-in</dt>
              <dd>{formatDateTime(user.lastLoginAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Signed-in devices</dt>
              <dd>{sessionCount}</dd>
            </div>
            {user.lockedUntil && user.lockedUntil > now && (
              <div className="flex justify-between text-amber-800">
                <dt>Locked until</dt>
                <dd>{formatDateTime(user.lockedUntil)}</dd>
              </div>
            )}
          </dl>
          <UserAccessActions id={user.id} active={user.isActive} hasPassword={Boolean(user.passwordHash)} isSelf={isSelf} />
        </Card>
      </div>
    </>
  );
}
