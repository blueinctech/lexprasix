import type { Metadata } from "next";
import Link from "next/link";
import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { FilterSelect, Flash, ListFilters, ListPager, STATUS_OPTIONS, Table } from "@/components/admin/ContentList";
import { Badge, btn, Card, EmptyState, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { authors, categories, postCategories, posts } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { can } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Blog posts" };

const PER_PAGE = 25;

export default async function PostsList({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage("posts.edit_own");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = ["published", "scheduled", "draft"].includes(sp.status ?? "") ? sp.status : undefined;
  const db = await getDb();
  const editAny = can(user.role, "posts.edit_any");

  const conds: (SQL | undefined)[] = [];
  if (!editAny) conds.push(eq(posts.authorId, user.authorId ?? "00000000-0000-0000-0000-000000000000"));
  if (q) conds.push(or(ilike(posts.title, `%${q}%`), ilike(posts.slug, `%${q}%`)));
  if (status) conds.push(eq(posts.status, status as "draft"));
  if (sp.category) conds.push(inArray(posts.id, db.select({ id: postCategories.postId }).from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId)).where(eq(categories.slug, sp.category))));
  if (editAny && sp.author) conds.push(eq(posts.authorId, sp.author));
  const where = and(...conds);

  const [[{ n }], rows, cats, authorRows] = await Promise.all([
    db.select({ n: count() }).from(posts).where(where),
    db
      .select({ id: posts.id, title: posts.title, slug: posts.slug, status: posts.status, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt, author: authors.name })
      .from(posts)
      .leftJoin(authors, eq(authors.id, posts.authorId))
      .where(where)
      .orderBy(sql`case when ${posts.status} = 'draft' then 0 else 1 end`, desc(posts.publishedAt), desc(posts.updatedAt))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ slug: categories.slug, name: categories.name }).from(categories).orderBy(categories.name),
    editAny ? db.select({ id: authors.id, name: authors.name }).from(authors).orderBy(authors.name) : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(n / PER_PAGE));
  const params = { q: q || undefined, status, category: sp.category, author: sp.author };

  return (
    <>
      <PageTitle
        title="Blog posts"
        description={editAny ? `${n} articles` : "Your articles. An editor publishes them after review."}
        actions={
          <Link href="/admin/posts/new/" className={btn("primary")}>
            New article
          </Link>
        }
      />
      <Flash params={sp} />
      <Card padded={false}>
        <ListFilters action="/admin/posts/" q={q}>
          <FilterSelect name="status" label="Status" value={status} options={STATUS_OPTIONS} />
          <FilterSelect name="category" label="Category" value={sp.category} options={cats.map((c) => ({ value: c.slug, label: c.name }))} />
          {editAny && <FilterSelect name="author" label="Author" value={sp.author} options={authorRows.map((a) => ({ value: a.id, label: a.name }))} />}
        </ListFilters>
        {rows.length ? (
          <Table head={["Title", "Author", "Status", "Published", "Updated"]}>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="max-w-md px-5 py-3">
                  <Link href={`/admin/posts/${p.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                    {p.title}
                  </Link>
                  <span className="block truncate text-xs text-slate-500">/{p.slug}/</span>
                </td>
                <td className="px-5 py-3 text-slate-600">{p.author ?? "—"}</td>
                <td className="px-5 py-3">
                  <Badge value={p.status} />
                </td>
                <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(p.publishedAt)}</td>
                <td className="px-5 py-3 whitespace-nowrap text-slate-600">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title="No articles found" text={q || status ? "Try a different search or filter." : "Write your first article."} />
        )}
        <ListPager base="/admin/posts/" params={params} page={page} pages={pages} />
      </Card>
    </>
  );
}
