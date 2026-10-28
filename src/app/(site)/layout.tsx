import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { getSettings } from "@/lib/content/queries";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { integrations, site } = await getSettings();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <SiteChrome gtmId={integrations.gtmId} tawk={integrations.tawkEnabled ? integrations.tawkPropertyId : ""} whatsapp={integrations.whatsappEnabled ? site.whatsapp : ""} />
    </>
  );
}
