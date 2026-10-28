import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flash } from "@/components/admin/ContentList";
import { RevisionsList } from "@/components/admin/RevisionsList";
import { ServiceEditor } from "@/components/admin/ServiceEditor";
import { Badge, PageTitle } from "@/components/admin/ui";
import { isUuid } from "@/lib/admin/editing";
import { requireUserPage } from "@/lib/auth/current";
import { loadService, serviceOptions } from "../load";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditService({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUserPage("services.manage");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [service, options] = await Promise.all([loadService(id), serviceOptions(id)]);
  if (!service) notFound();
  return (
    <>
      <PageTitle title={service.title} description={<Badge value={service.status} />} back={{ href: "/admin/services/", label: "All services" }} />
      <Flash params={await searchParams} />
      <ServiceEditor service={service} otherServices={options.otherServices} documents={options.documents} sidebarExtra={<RevisionsList type="service" id={id} />} />
    </>
  );
}
