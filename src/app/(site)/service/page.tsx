import type { Metadata } from "next";
import { CtaBlock } from "@/components/blocks/Blocks";
import { JsonLd, PageHeader, ServiceCard } from "@/components/content/common";
import { Container } from "@/components/ui/primitives";
import { getPageByPath, getSettings, listServices } from "@/lib/content/queries";
import { breadcrumbNode, buildMetadata, graph, organizationNode, webPageNode, websiteNode } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPageByPath("service")]);
  return buildMetadata({ settings, path: "/service/", title: page?.title ?? "Services", description: page?.summary, seo: page?.seo });
}

export default async function ServicesIndex() {
  const [settings, page, services] = await Promise.all([getSettings(), getPageByPath("service"), listServices()]);
  const crumbs = [{ name: "Home", path: "/" }, { name: page?.title ?? "Services", path: "/service/" }];
  return (
    <>
      <JsonLd data={graph(webPageNode({ path: "/service/", title: page?.title ?? "Services", type: ["WebPage", "CollectionPage"], hasBreadcrumb: true }), breadcrumbNode("/service/", crumbs), websiteNode(settings), organizationNode(settings))} />
      <PageHeader crumbs={crumbs} eyebrow="What we do" title={page?.title ?? "Our Services"} summary={page?.summary} />
      <Container className="py-16 sm:py-24">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s, i) => (
            <ServiceCard key={s.slug} service={s} index={i} />
          ))}
        </div>
      </Container>
      <CtaBlock block={{ heading: settings.cta.consultationTitle, text: settings.cta.consultationText, primary: { label: "Book a free call", href: "/book-appointment/" }, secondary: { label: "Contact us", href: "/contact-us/" } }} />
    </>
  );
}
