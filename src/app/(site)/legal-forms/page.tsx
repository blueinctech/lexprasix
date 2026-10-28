import { DocumentIndex, documentIndexMetadata } from "@/components/content/DocumentIndex";

export const generateMetadata = () => documentIndexMetadata("legal-forms");

export default function Page() {
  return <DocumentIndex path="legal-forms" />;
}
