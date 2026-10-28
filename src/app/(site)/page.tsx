import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageView } from "@/components/content/views";
import { getPageByPath, getSettings } from "@/lib/content/queries";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPageByPath("")]);
  return buildMetadata({ settings, path: "/", title: page?.title ?? settings.site.name, description: page?.summary, seo: { title: settings.seo.homeTitle, ...page?.seo }, image: page?.ogImage ?? page?.featuredImage });
}

export default async function HomePage() {
  const page = await getPageByPath("");
  if (!page) notFound();
  return <PageView page={page} />;
}
