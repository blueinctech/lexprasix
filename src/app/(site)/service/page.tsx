import type { Metadata } from "next";
import { Blocks } from "@/components/blocks/Blocks";
import { JsonLd, PageHeader, ServiceCard } from "@/components/content/common";
import { Carousel } from "@/components/ui/Carousel";
import { Container, SectionHeading } from "@/components/ui/primitives";
import type { AnyBlock } from "@/lib/blocks";
import { getPageByPath, getSettings, listServices } from "@/lib/content/queries";
import { breadcrumbNode, buildMetadata, graph, organizationNode, webPageNode, websiteNode } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPageByPath("service")]);
  return buildMetadata({ settings, path: "/service/", title: page?.title ?? "Services", description: page?.summary, seo: page?.seo });
}

// As on the live site: title band, the services slider, then the page's own
// sections (testimonials and client logos, editable under Admin → Pages).
export default async function ServicesIndex() {
  const [settings, page, services] = await Promise.all([getSettings(), getPageByPath("service"), listServices()]);
  const crumbs = [{ name: "Home", path: "/" }, { name: page?.title ?? "Services", path: "/service/" }];
  return (
    <>
      <JsonLd data={graph(webPageNode({ path: "/service/", title: page?.title ?? "Services", type: ["WebPage", "CollectionPage"], hasBreadcrumb: true }), breadcrumbNode("/service/", crumbs), websiteNode(settings), organizationNode(settings))} />
      <PageHeader crumbs={crumbs} title={page?.title ?? "Our Services"} />
      <section className="pt-20 lg:pt-[7.5rem]">
        <Container>
          <Carousel centered header={<SectionHeading eyebrow="What We Do" heading="Legal Services We Offer" align="center" />} label="services" itemClass="basis-full sm:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-4.5rem)/4)]">
            {services.map((s) => (
              <ServiceCard key={s.slug} service={s} />
            ))}
          </Carousel>
        </Container>
      </section>
      {page && <Blocks blocks={page.blocks as AnyBlock[]} template={page.template} />}
    </>
  );
}
