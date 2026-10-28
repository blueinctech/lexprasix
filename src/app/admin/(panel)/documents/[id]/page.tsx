import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/ContentList";
import { DocumentEditor } from "@/components/admin/DocumentEditor";
import { RevisionsList } from "@/components/admin/RevisionsList";
import { Badge, PageTitle } from "@/components/admin/ui";
import { isUuid } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";
import { documentForms, loadDocument } from "../load";

export const metadata: Metadata = { title: "Edit legal document page" };

export default async function EditDocument({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("documents.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const doc = await loadDocument(id);
  if (!doc) notFound();
  return (
    <>
      <PageTitle title={doc.title} description={<Badge value={doc.status} />} back={{ href: "/admin/documents/", label: "All legal documents" }} />
      <Flash params={await searchParams} />
      <DocumentEditor doc={doc} forms={documentForms()} sidebarExtra={<RevisionsList type="document" id={id} />} />
    </>
  );
}
