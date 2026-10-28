import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/ContentList";
import { TestimonialForm } from "@/components/admin/TestimonialForm";
import { PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { testimonials } from "@/db/schema";
import { isUuid } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Edit testimonial" };

export default async function EditTestimonial({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("pages.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const db = await getDb();
  const [t] = await db.select().from(testimonials).where(eq(testimonials.id, id));
  if (!t) notFound();
  return (
    <>
      <PageTitle title={t.name} back={{ href: "/admin/testimonials/", label: "All testimonials" }} />
      <Flash params={await searchParams} />
      <TestimonialForm t={{ id: t.id, name: t.name, role: t.role, quote: t.quote, source: t.source, sourceUrl: t.sourceUrl, featured: t.featured, status: t.status }} />
    </>
  );
}
