import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { getPageByPath, getSettings, listDocuments } from "@/lib/content/queries";
import { breadcrumbNode, buildMetadata, graph, organizationNode, webPageNode, websiteNode } from "@/lib/seo";
import { JsonLd, PageHeader } from "./common";

// /legal-forms/ (all documents) and /corporate-filings/ (filings only).


export async function documentIndexMetadata(path: "legal-forms" | "corporate-filings"): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSettings(), getPageByPath(path)]);
  return buildMetadata({ settings, path: `/${path}/`, title: page?.title ?? "Legal Documents", description: page?.summary, seo: page?.seo });
}

export async function DocumentIndex({ path }: { path: "legal-forms" | "corporate-filings" }) {
  const [settings, page, docs] = await Promise.all([getSettings(), getPageByPath(path), listDocuments()]);
  const title = page?.title ?? (path === "legal-forms" ? "Legal Documents" : "Corporate Filings");
  const crumbs = [{ name: "Home", path: "/" }, ...(path === "corporate-filings" ? [{ name: "Legal documents", path: "/legal-forms/" }] : []), { name: title, path: `/${path}/` }];
  const list = docs.filter((d) => path === "legal-forms" || d.group === "corporate-filings").sort((x, y) => x.title.localeCompare(y.title));
  return (
    <>
      <JsonLd data={graph(webPageNode({ path: `/${path}/`, title, type: ["WebPage", "CollectionPage"], description: page?.summary, hasBreadcrumb: true }), breadcrumbNode(`/${path}/`, crumbs), websiteNode(settings), organizationNode(settings))} />
      <PageHeader crumbs={crumbs} title={title} />
      {/* As on the live site: one line-wrapped list of every form, separated by thin rules. */}
      <Container className="py-20 lg:py-[7.5rem]">
        <ul className="-ml-[0.95rem] flex flex-wrap gap-y-1 text-[1.0625rem] leading-[1.6]">
          {list.map((d) => (
            <li key={d.slug} className="border-r border-heading/70 px-[0.95rem] last:border-r-0">
              <Link href={`/${d.slug}/`} className="text-heading hover:text-gold-500">
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
