import type { Metadata } from "next";
import { PageEditor } from "@/components/admin/PageEditor";
import { PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage() {
  await requireUserPage("pages.manage");
  return (
    <>
      <PageTitle title="New page" back={{ href: "/admin/pages/", label: "All pages" }} />
      <PageEditor
        page={{
          id: null,
          title: "",
          path: "",
          template: "default",
          summary: "",
          blocks: [{ id: "b-intro", type: "richText", heading: "", html: "" }],
          status: "draft",
          publishedAtInput: "",
          featuredImage: null,
          ogImage: null,
          seo: {},
        }}
        images={{}}
      />
    </>
  );
}
