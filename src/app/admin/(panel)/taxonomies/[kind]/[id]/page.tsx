import type { Metadata } from "next";
import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { deleteTerm, saveTerm } from "@/app/admin/_actions/taxonomies";
import { SeoPanel } from "@/components/admin/EditorFields";
import { ActionForm, Card, Checkbox, PageTitle, SubmitButton, TextArea, TextInput } from "@/components/admin/ui";
import { getDb } from "@/db";
import { categories, postCategories, postTags, tags } from "@/db/schema";
import { isUuid, pickedMedia } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Edit term" };

export default async function EditTerm({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requireUserPage("taxonomies.manage");
  const { kind: rawKind, id } = await params;
  const kind = rawKind === "tag" ? "tag" : rawKind === "category" ? "category" : null;
  if (!kind || !isUuid(id)) notFound();
  const db = await getDb();
  const table = kind === "category" ? categories : (tags as unknown as typeof categories);
  const [row] = await db.select().from(table).where(eq(table.id, id));
  if (!row) notFound();
  const [{ n }] =
    kind === "category"
      ? await db.select({ n: count() }).from(postCategories).where(eq(postCategories.categoryId, id))
      : await db.select({ n: count() }).from(postTags).where(eq(postTags.tagId, id));
  const og = (await pickedMedia([row.seo.ogImageId])).get(row.seo.ogImageId ?? "") ?? null;
  const label = kind === "category" ? "Category" : "Tag";
  return (
    <>
      <PageTitle title={row.name} description={`${label} · used by ${n} article${n === 1 ? "" : "s"}`} back={{ href: `/admin/taxonomies/?kind=${kind}`, label: "Categories & tags" }} />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <ActionForm action={saveTerm}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={row.id} />
          <Card>
            <div className="grid gap-4">
              <TextInput label="Name" name="name" defaultValue={row.name} required maxLength={80} />
              <TextInput label="Slug" name="slug" defaultValue={row.slug} hint={`Archive URL: /${kind}/${row.slug}/. Changing it adds a redirect.`} />
              <TextArea label="Description" name="description" defaultValue={row.description} rows={4} />
            </div>
          </Card>
          <SeoPanel seo={row.seo} defaultTitle={`${row.name} Archives - Lexpraxis Solicitors`} defaultDescription={row.description || "A default description is used."} path={`/${kind}/${row.slug}/`} ogImage={og} />
          <div>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ActionForm>
        <div className="content-start">
          <Card title="Delete">
            <ActionForm action={deleteTerm}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={row.id} />
              {n > 0 && <Checkbox name="confirmUsed" label={`Remove it from ${n} article${n === 1 ? "" : "s"}`} hint="The archive page will redirect to the blog." />}
              <SubmitButton variant="danger" pendingLabel="Deleting…" confirm={`Delete this ${kind}?`}>
                Delete {label.toLowerCase()}
              </SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
