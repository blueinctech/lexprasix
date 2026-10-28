import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq } from "drizzle-orm";
import { btn, Card, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { authors, posts } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Author profiles" };

export default async function AuthorsPage() {
  await requireUserPage("authors.manage");
  const db = await getDb();
  const list = await db
    .select({ id: authors.id, name: authors.name, slug: authors.slug, role: authors.role, n: count(posts.id) })
    .from(authors)
    .leftJoin(posts, eq(posts.authorId, authors.id))
    .groupBy(authors.id)
    .orderBy(asc(authors.name));
  return (
    <>
      <PageTitle
        title="Author profiles"
        description="Public profiles shown on articles and at /author/…/. Staff accounts are linked to a profile from the Users page."
        back={{ href: "/admin/users/", label: "Users" }}
        actions={
          <Link href="/admin/users/authors/new/" className={btn("primary")}>
            New author
          </Link>
        }
      />
      <Card padded={false}>
        <ul className="divide-y divide-slate-100">
          {list.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/users/authors/${a.id}/`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
                <span>
                  <span className="block font-medium text-slate-900">{a.name}</span>
                  <span className="block text-xs text-slate-500">
                    /author/{a.slug}/{a.role ? ` · ${a.role}` : ""}
                  </span>
                </span>
                <span className="text-sm text-slate-600">
                  {a.n} article{a.n === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
