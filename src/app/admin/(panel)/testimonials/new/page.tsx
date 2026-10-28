import type { Metadata } from "next";
import { TestimonialForm } from "@/components/admin/TestimonialForm";
import { PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "New testimonial" };

export default async function NewTestimonial() {
  await requireUserPage("pages.manage");
  return (
    <>
      <PageTitle title="New testimonial" back={{ href: "/admin/testimonials/", label: "All testimonials" }} />
      <TestimonialForm t={{ id: null, name: "", role: "", quote: "", source: "website", sourceUrl: "", featured: true, status: "draft" }} />
    </>
  );
}
