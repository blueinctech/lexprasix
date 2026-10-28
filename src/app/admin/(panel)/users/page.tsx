import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import { InviteUserForm } from "@/components/admin/UserForms";
import { Badge, btn, Card, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { authors, sessions, users } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireUserPage("users.manage");
  const db = await getDb();
  const now = new Date();
  const [list, authorList, active] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt, hasPassword: users.passwordHash, author: authors.name })
      .from(users)
      .leftJoin(authors, eq(authors.id, users.authorId))
      .orderBy(asc(users.name)),
    db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(asc(authors.name)),
    db
      .select({ userId: sessions.userId, n: count() })
      .from(sessions)
      .where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, now), gt(sessions.idleExpiresAt, now)))
      .groupBy(sessions.userId),
  ]);
  const sessionsBy = new Map(active.map((a) => [a.userId, a.n]));
  return (
    <>
      <PageTitle
        title="Users"
        description="Staff who can sign in to this admin. Accounts are created by invitation only."
        actions={
          <Link href="/admin/users/authors/" className={btn("secondary")}>
            Author profiles
          </Link>
        }
      />
      <Card padded={false} className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last sign-in</th>
                <th className="px-5 py-3 font-medium">Signed-in devices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/users/${u.id}/`} className="font-medium text-slate-900 hover:underline">
                      {u.name}
                      {u.id === me.id && <span className="ml-1 text-xs font-normal text-slate-500">(you)</span>}
                    </Link>
                    <span className="block text-xs text-slate-500">
                      {u.email}
                      {u.author ? ` · writes as ${u.author}` : ""}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={u.role} label={ROLE_LABELS[u.role]} />
                  </td>
                  <td className="px-5 py-3">
                    {!u.isActive ? <Badge value="inactive" label="Deactivated" /> : !u.hasPassword ? <Badge value="pending" label="Invited" /> : <Badge value="active" label="Active" />}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{formatDateTime(u.lastLoginAt)}</td>
                  <td className="px-5 py-3 text-slate-600">{sessionsBy.get(u.id) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="Invite someone">
        <InviteUserForm authors={authorList.map((a) => ({ value: a.id, label: a.name }))} />
      </Card>
    </>
  );
}
