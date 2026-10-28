import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq, ilike, sql } from "drizzle-orm";
import { saveTerm } from "@/app/admin/_actions/taxonomies";
import { Flash, ListFilters, Table } from "@/components/admin/ContentList";
import { ActionForm, Card, cx, EmptyState, PageTitle, SubmitButton, TextArea, TextInput } from "@/components/admin/ui";
import { getDb } from "@/db";
import { categories, postCategories, postTags, tags } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Categories & tags" };

export default async function Taxonomies({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("taxonomies.manage");
  const sp = await searchParams;
  const kind = sp.kind === "tag" ? "tag" : "category";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const db = await getDb();
  const rows =
    kind === "category"
      ? await db
          .select({ id: categories.id, name: categories.name, slug: categories.slug, n: count(postCategories.postId) })
          .from(categories)
          .leftJoin(postCategories, eq(postCategories.categoryId, categories.id))
          .where(q ? ilike(categories.name, `%${q}%`) : sql`true`)
          .groupBy(categories.id)
          .orderBy(asc(categories.name))
      : await db
          .select({ id: tags.id, name: tags.name, slug: tags.slug, n: count(postTags.postId) })
          .from(tags)
          .leftJoin(postTags, eq(postTags.tagId, tags.id))
          .where(q ? ilike(tags.name, `%${q}%`) : sql`true`)
          .groupBy(tags.id)
          .orderBy(asc(tags.name));
  const label = kind === "category" ? "Category" : "Tag";
  return (
    <>
      <PageTitle title="Categories & tags" description="Archive pages live at /category/… and /tag/…. Renaming a slug adds a redirect from the old address." />
      <Flash params={sp} />
      <div className="mb-4 flex gap-2" role="tablist">
        {(["category", "tag"] as const).map((k) => (
          <Link key={k} href={`/admin/taxonomies/?kind=${k}`} role="tab" aria-selected={k === kind} className={cx("rounded-lg px-4 py-2 text-sm font-medium", k === kind ? "bg-navy-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>
            {k === "category" ? "Categories" : "Tags"}
          </Link>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card padded={false}>
          <ListFilters action={`/admin/taxonomies/`} q={q}>
            <input type="hidden" name="kind" value={kind} />
          </ListFilters>
          {rows.length ? (
            <Table head={["Name", "URL", "Articles"]}>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/taxonomies/${kind}/${r.id}/`} className="font-medium text-slate-900 hover:text-navy-700">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    /{kind}/{r.slug}/
                  </td>
                  <td className="px-5 py-3 text-slate-600">{r.n}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <EmptyState title={`No ${kind === "category" ? "categories" : "tags"} found`} />
          )}
        </Card>
        <Card title={`New ${label.toLowerCase()}`}>
          <ActionForm action={saveTerm} resetOnSuccess>
            <input type="hidden" name="kind" value={kind} />
            <TextInput label="Name" name="name" required maxLength={80} />
            <TextInput label="Slug" name="slug" hint="Leave empty to generate from the name." />
            <TextArea label="Description" name="description" rows={3} hint="Shown at the top of the archive page." />
            <SubmitButton>Create {label.toLowerCase()}</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
