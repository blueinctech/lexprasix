import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceView } from "@/components/content/views";
import { getService, getSettings, listServices } from "@/lib/content/queries";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await listServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, svc] = await Promise.all([getSettings(), getService(slug)]);
  if (!svc) return {};
  return buildMetadata({ settings, path: `/service/${slug}/`, title: svc.title, description: svc.summary, seo: svc.seo, image: svc.ogImage ?? svc.featuredImage });
}

export default async function ServicePage({ params }: Props) {
  const svc = await getService((await params).slug);
  if (!svc) notFound();
  return <ServiceView service={svc} />;
}
