import type { Metadata } from "next";
import { ServiceEditor } from "@/components/admin/ServiceEditor";
import { PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";
import { serviceOptions } from "../load";

export const metadata: Metadata = { title: "New service" };

export default async function NewService() {
  await requireUserPage("services.manage");
  const options = await serviceOptions(null);
  return (
    <>
      <PageTitle title="New service" back={{ href: "/admin/services/", label: "All services" }} />
      <ServiceEditor
        service={{
          id: null, title: "", slug: "", shortTitle: "", summary: "", body: "", audience: "", process: [], faqs: [], relatedServiceIds: [], relatedDocumentIds: [],
          ctaLabel: "Book a free consultation", ctaHref: "/book-appointment/", icon: "scale", status: "draft", publishedAtInput: "", featuredImage: null, ogImage: null, seo: {},
        }}
        otherServices={options.otherServices}
        documents={options.documents}
      />
    </>
  );
}
