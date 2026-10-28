import type { Metadata } from "next";
import { DocumentEditor } from "@/components/admin/DocumentEditor";
import { PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";
import { documentForms } from "../load";

export const metadata: Metadata = { title: "New legal document page" };

export default async function NewDocument() {
  await requireUserPage("documents.manage");
  return (
    <>
      <PageTitle title="New legal document page" description="Each page shows one questionnaire. Questionnaires are defined in code." back={{ href: "/admin/documents/", label: "All legal documents" }} />
      <DocumentEditor
        doc={{ id: null, title: "", slug: "", group: "agreements", summary: "", body: "", deliverables: [], requirements: [], faqs: [], formId: "", sortOrder: 0, status: "draft", publishedAtInput: "", featuredImage: null, ogImage: null, seo: {} }}
        forms={documentForms()}
      />
    </>
  );
}
