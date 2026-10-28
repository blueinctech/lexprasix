import type { Metadata } from "next";
import { CtaBlock } from "@/components/blocks/Blocks";
import { Container } from "@/components/ui/primitives";
import { getPageByPath, getSettings, listDocuments } from "@/lib/content/queries";
import { breadcrumbNode, buildMetadata, graph, organizationNode, webPageNode, websiteNode } from "@/lib/seo";
import { DocumentCard, JsonLd, PageHeader } from "./common";

// /legal-forms/ (all documents) and /corporate-filings/ (filings only).

const GROUPS = [
  { key: "corporate-filings", title: "Corporate filings", text: "Registrations and filings with the CAC, tax authorities and IP registries." },
  { key: "agreements", title: "Agreements", text: "Contracts and legal documents drafted by our lawyers from your answers." },
] as const;

export async function documentIndexMetadata(path: "legal-forms" | "corporate-filings"): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPageByPath(path)]);
  return buildMetadata({ settings, path: `/${path}/`, title: page?.title ?? "Legal Documents", description: page?.summary, seo: page?.seo });
}

export async function DocumentIndex({ path }: { path: "legal-forms" | "corporate-filings" }) {
  const [settings, page, docs] = await Promise.all([getSettings(), getPageByPath(path), listDocuments()]);
  const title = page?.title ?? (path === "legal-forms" ? "Legal Documents" : "Corporate Filings");
  const crumbs = [{ name: "Home", path: "/" }, ...(path === "corporate-filings" ? [{ name: "Legal documents", path: "/legal-forms/" }] : []), { name: title, path: `/${path}/` }];
  const groups = path === "corporate-filings" ? GROUPS.filter((g) => g.key === "corporate-filings") : GROUPS;
  return (
    <>
      <JsonLd data={graph(webPageNode({ path: `/${path}/`, title, type: ["WebPage", "CollectionPage"], description: page?.summary, hasBreadcrumb: true }), breadcrumbNode(`/${path}/`, crumbs), websiteNode(settings), organizationNode(settings))} />
      <PageHeader crumbs={crumbs} eyebrow="Start online" title={title} summary={page?.summary} />
      <Container className="grid gap-16 py-16 sm:py-20">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`} className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id={`g-${g.key}`} className="text-3xl text-navy-950">
                {g.title}
              </h2>
              <p className="mt-3 text-ink-muted">{g.text}</p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:col-span-8">
              {docs
                .filter((d) => d.group === g.key)
                .map((d) => (
                  <DocumentCard key={d.slug} doc={d} />
                ))}
            </div>
          </section>
        ))}
      </Container>
      <CtaBlock block={{ heading: "Not sure which document you need?", text: "Tell us what you're trying to do and we'll point you to the right filing or agreement.", primary: { label: "Book a free call", href: "/book-appointment/" }, secondary: { label: "Contact us", href: "/contact-us/" } }} />
    </>
  );
}
