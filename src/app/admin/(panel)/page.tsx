import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { Badge, btn, Card, EmptyState, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { auditLog, documents, emailOutbox, pages, posts, services, submissions, users } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Dashboard" };

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// Every figure here is a live database count; nothing is estimated.
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUserPage();
  const denied = (await searchParams).denied;
  const db = await getDb();
  const seeEnquiries = can(user.role, "submissions.view");
  const since = daysAgo(30);

  const [postStats, pageStats, svc, docs, recentSubs, subStats, recentPosts, activity, failed] = await Promise.all([
    db.select({ status: posts.status, n: count() }).from(posts).groupBy(posts.status),
    db.select({ status: pages.status, n: count() }).from(pages).groupBy(pages.status),
    db.select({ n: count() }).from(services).where(eq(services.status, "published")),
    db.select({ n: count() }).from(documents).where(eq(documents.status, "published")),
    seeEnquiries
      ? db.select({ id: submissions.id, reference: submissions.reference, formTitle: submissions.formTitle, name: submissions.name, status: submissions.status, createdAt: submissions.createdAt }).from(submissions).where(sql`${submissions.status} <> 'spam'`).orderBy(desc(submissions.createdAt)).limit(6)
      : Promise.resolve([]),
    seeEnquiries
      ? db.select({ status: submissions.status, n: count() }).from(submissions).where(gte(submissions.createdAt, since)).groupBy(submissions.status)
      : Promise.resolve([]),
    db.select({ id: posts.id, title: posts.title, status: posts.status, updatedAt: posts.updatedAt }).from(posts).where(user.role === "author" ? eq(posts.authorId, user.authorId ?? "00000000-0000-0000-0000-000000000000") : undefined).orderBy(desc(posts.updatedAt)).limit(6),
    can(user.role, "audit.view")
      ? db.select({ action: auditLog.action, entityType: auditLog.entityType, createdAt: auditLog.createdAt, who: users.name }).from(auditLog).leftJoin(users, eq(users.id, auditLog.userId)).orderBy(desc(auditLog.createdAt)).limit(8)
      : Promise.resolve([]),
    can(user.role, "email.view") ? db.select({ n: count() }).from(emailOutbox).where(inArray(emailOutbox.status, ["failed"])) : Promise.resolve([{ n: 0 }]),
  ]);

  const by = (rows: { status: string; n: number }[], s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  const openEnquiries = subStats.filter((r) => ["new", "in_progress", "awaiting_client"].includes(r.status)).reduce((a, r) => a + r.n, 0);
  const stats = [
    ...(seeEnquiries ? [{ label: "New enquiries", value: by(subStats, "new"), href: "/admin/submissions/?status=new", note: `${openEnquiries} open in the last 30 days` }] : []),
    { label: "Published articles", value: by(postStats, "published"), href: "/admin/posts/", note: `${by(postStats, "draft")} drafts · ${by(postStats, "scheduled")} scheduled` },
    { label: "Published pages", value: by(pageStats, "published") + svc[0].n + docs[0].n, href: "/admin/pages/", note: `${svc[0].n} services · ${docs[0].n} legal documents` },
    ...(failed[0].n ? [{ label: "Failed emails", value: failed[0].n, href: "/admin/emails/?status=failed", note: "Need attention" }] : []),
  ];

  return (
    <>
      <PageTitle
        title={`Welcome, ${user.name.split(" ")[0]}`}
        description="Overview of the website and client enquiries."
        actions={
          <>
            <Link href="/admin/posts/new/" className={btn("primary")}>
              New article
            </Link>
            {can(user.role, "pages.manage") && (
              <Link href="/admin/pages/new/" className={btn("secondary")}>
                New page
              </Link>
            )}
          </>
        }
      />
      {denied && <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">You don&apos;t have permission to open that section.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-navy-700/40">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{s.value}</p>
            <p className="mt-1 text-xs text-slate-500">{s.note}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {seeEnquiries && (
          <Card title="Latest enquiries" actions={<Link href="/admin/submissions/" className="text-xs font-medium text-navy-700 hover:underline">View all</Link>} padded={false}>
            {recentSubs.length ? (
              <ul className="divide-y divide-slate-100">
                {recentSubs.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/submissions/${s.id}/`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">{s.name || "(no name)"}</span>
                        <span className="block truncate text-xs text-slate-500">
                          {s.formTitle} · {s.reference} · {formatDateTime(s.createdAt)}
                        </span>
                      </span>
                      <Badge value={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No enquiries yet" text="Submissions from the contact and legal-document forms appear here." />
            )}
          </Card>
        )}
        <Card title={user.role === "author" ? "Your recent articles" : "Recently edited articles"} actions={<Link href="/admin/posts/" className="text-xs font-medium text-navy-700 hover:underline">All articles</Link>} padded={false}>
          <ul className="divide-y divide-slate-100">
            {recentPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/posts/${p.id}/`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{p.title}</span>
                    <span className="block text-xs text-slate-500">Updated {formatDateTime(p.updatedAt)}</span>
                  </span>
                  <Badge value={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        {activity.length > 0 && (
          <Card title="Recent activity" actions={<Link href="/admin/activity/" className="text-xs font-medium text-navy-700 hover:underline">Activity log</Link>} padded={false}>
            <ul className="divide-y divide-slate-100 text-sm">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <span>
                    <span className="font-medium text-slate-900">{a.who ?? "System"}</span> <span className="text-slate-600">{a.action.replace(/[._]/g, " ")}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

