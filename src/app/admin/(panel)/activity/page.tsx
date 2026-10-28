import type { Metadata } from "next";
import Link from "next/link";
import { count, desc, eq, ilike } from "drizzle-orm";
import { Card, EmptyState, formatDateTime, PageTitle, Pager } from "@/components/admin/ui";
import { getDb } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Activity log" };

const PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requireUserPage("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const prefix = (sp.action ?? "").replace(/[^a-z_.]/g, "").slice(0, 40);
  const where = prefix ? ilike(auditLog.action, `${prefix}%`) : undefined;
  const db = await getDb();
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: count() }).from(auditLog).where(where),
    db
      .select({ id: auditLog.id, action: auditLog.action, entityType: auditLog.entityType, entityId: auditLog.entityId, details: auditLog.details, createdAt: auditLog.createdAt, who: users.name, email: users.email })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
  ]);
  const filters = ["auth", "submission", "post", "page", "service", "document", "media", "menu", "settings", "user", "redirect", "email"];
  const link = (entityType: string | null, id: string | null) => {
    if (!id) return null;
    const map: Record<string, string> = { submission: "submissions", post: "posts", page: "pages", service: "services", document: "documents", user: "users" };
    return map[entityType ?? ""] ? `/admin/${map[entityType!]}/${id}/` : null;
  };
  return (
    <>
      <PageTitle title="Activity log" description="Sign-ins, publishing, deletions, exports and access to client enquiries. Kept for accountability; it never contains passwords or client answers." />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/activity/" className={`rounded-full px-3 py-1 ${!prefix ? "bg-navy-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>
          All
        </Link>
        {filters.map((f) => (
          <Link key={f} href={`/admin/activity/?action=${f}`} className={`rounded-full px-3 py-1 ${prefix === f ? "bg-navy-900 text-white" : "bg-white ring-1 ring-slate-200"}`}>
            {f}
          </Link>
        ))}
      </div>
      <Card padded={false}>
        {rows.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {rows.map((r) => {
              const href = link(r.entityType, r.entityId);
              const details = Object.entries(r.details ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium text-slate-900">{r.who ?? "System"}</span> <span className="font-mono text-xs text-slate-600">{r.action}</span>
                      {href && (
                        <Link href={href} className="ml-2 text-xs text-navy-700 hover:underline">
                          open
                        </Link>
                      )}
                    </p>
                    {details.length > 0 && <p className="mt-0.5 truncate text-xs text-slate-500">{details.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No activity yet" />
        )}
        <Pager page={page} pages={Math.max(1, Math.ceil(n / PAGE))} href={(p) => `/admin/activity/?${new URLSearchParams({ ...(prefix ? { action: prefix } : {}), page: String(p) })}`} />
      </Card>
    </>
  );
}
