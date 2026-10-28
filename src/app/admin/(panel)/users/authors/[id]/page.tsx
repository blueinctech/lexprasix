import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { asc, count, eq, like } from "drizzle-orm";
import { AuthorForm, DeleteAuthorForm, type AuthorValues } from "@/components/admin/UserForms";
import { Card, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { authors, media, posts } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Author profile" };

export default async function AuthorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireUserPage("authors.manage");
  const { id } = await params;
  const created = (await searchParams).created;
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [row] = isNew ? [] : await db.select().from(authors).where(eq(authors.id, id));
  if (!isNew && !row) notFound();
  const [images, [{ n }]] = await Promise.all([
    db.select({ id: media.id, filename: media.filename }).from(media).where(like(media.mimeType, "image/%")).orderBy(asc(media.filename)).limit(1000),
    isNew ? Promise.resolve([{ n: 0 }]) : db.select({ n: count() }).from(posts).where(eq(posts.authorId, id)),
  ]);
  const values: AuthorValues = row
    ? { id: row.id, name: row.name, slug: row.slug, role: row.role, bio: row.bio, photoId: row.photoId, seoTitle: row.seo.title ?? "", seoDescription: row.seo.description ?? "" }
    : { name: "", slug: "", role: "", bio: "", photoId: null, seoTitle: "", seoDescription: "" };
  return (
    <>
      <PageTitle title={row?.name ?? "New author"} description={row ? `${n} article${n === 1 ? "" : "s"}` : undefined} back={{ href: "/admin/users/authors/", label: "Author profiles" }} />
      {created && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Author profile created.</p>}
      <div className="grid gap-6">
        <Card title="Profile">
          <AuthorForm author={values} photos={images.map((i) => ({ value: i.id, label: i.filename }))} />
        </Card>
        {row && n === 0 && (
          <Card title="Delete">
            <DeleteAuthorForm id={row.id} />
          </Card>
        )}
      </div>
    </>
  );
}
