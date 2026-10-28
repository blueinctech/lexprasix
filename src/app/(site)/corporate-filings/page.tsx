import { DocumentIndex, documentIndexMetadata } from "@/components/content/DocumentIndex";

export const generateMetadata = () => documentIndexMetadata("corporate-filings");

export default function Page() {
  return <DocumentIndex path="corporate-filings" />;
}
