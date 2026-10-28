import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/ContentList";
import { PageEditor } from "@/components/admin/PageEditor";
import { RevisionsList } from "@/components/admin/RevisionsList";
import { Badge, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { pages } from "@/db/schema";
import { isUuid, pickedMedia, toLagosInput } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";
import { resolveMediaInHtml } from "@/lib/content/queries";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("pages.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = await getDb();
  const [row] = await db.select().from(pages).where(eq(pages.id, id));
  if (!row) notFound();
  const imageIds = row.blocks.flatMap((b) => (b.type === "hero" && typeof b.imageId === "string" ? [b.imageId] : []));
  const media = await pickedMedia([row.featuredImageId, row.seo.ogImageId, ...imageIds]);
  // Rich text is edited with images loaded from the media host.
  const blocks = row.blocks.map((b) => (b.type === "richText" ? { ...b, html: resolveMediaInHtml(String(b.html ?? "")) } : b));
  return (
    <>
      <PageTitle title={row.title} description={<Badge value={row.status} />} back={{ href: "/admin/pages/", label: "All pages" }} />
      <Flash params={await searchParams} />
      <PageEditor
        page={{
          id: row.id,
          title: row.title,
          path: row.path,
          template: row.template,
          summary: row.summary,
          blocks,
          status: row.status,
          publishedAtInput: toLagosInput(row.publishedAt),
          featuredImage: media.get(row.featuredImageId ?? "") ?? null,
          ogImage: media.get(row.seo.ogImageId ?? "") ?? null,
          seo: row.seo,
        }}
        images={Object.fromEntries(media)}
        sidebarExtra={<RevisionsList type="page" id={row.id} />}
      />
    </>
  );
}
