import Image from "next/image";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { getMenu, getSettings, TAGS } from "@/lib/content/queries";
import { Icon } from "@/components/ui/Icon";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

// Matches the WordPress (Ensaf) footer: a navy footer
// with page and service links, the logo with the firm's motto and social
// buttons, and the office / phone / email column.

const SOCIAL_ORDER = ["facebook", "instagram", "linkedin", "youtube", "x"] as const;
const SOCIAL_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", x: "X" };

/** "Sign Up To Get Latest Update" band; on the live site it sits above the footer on the homepage only. */
export function NewsletterBand() {
  return (
    // As on the live site: a photo of law books across the band, with a navy
    // panel over its left 49% holding the heading.
    <section aria-labelledby="newsletter-title" className="grid grid-cols-1 bg-[#112347] bg-[url('/theme/newsletter-bg.jpg')] bg-cover bg-[position:100%_0] lg:grid-cols-[49%_51%]">
      <div className="bg-[#112347] px-4 py-14 sm:px-6 lg:flex lg:min-h-[14.875rem] lg:flex-col lg:justify-center lg:py-12 lg:pl-[6.25rem]">
        <p className="font-display text-lg font-semibold text-white">Newsletter</p>
        <h2 id="newsletter-title" className="mt-2 text-3xl font-semibold text-white sm:text-[2.625rem]">
          Sign Up To Get Latest Update
        </h2>
      </div>
      <div className="flex min-w-0 items-center px-4 py-10 sm:px-6 lg:py-0 lg:pr-[6.25rem] lg:pl-11">
        <NewsletterForm variant="band" />
      </div>
    </section>
  );
}

export async function Footer() {
  "use cache";
  cacheTag(TAGS.settings, TAGS.menus);
  cacheLife("days");
  const [settings, services, pages, legal] = await Promise.all([getSettings(), getMenu("footer-services"), getMenu("footer-company"), getMenu("footer-legal")]);
  const { site } = settings;
  const year = new Date().getFullYear();
  const pageLinks = [...pages, ...legal.filter((l) => !pages.some((p) => p.href === l.href))];
  return (
    <footer>
      <div className="bg-navy-950 text-footer-text">
        <div className="mx-auto grid max-w-[82.5rem] gap-12 px-4 py-14 sm:px-6 md:grid-cols-2 xl:grid-cols-[13rem_26rem_1fr_17rem] xl:gap-0 xl:px-0">
          <div className="xl:pr-8 xl:pl-5">
            <h2 className="font-display text-2xl font-medium text-gold-400">Pages</h2>
            <ul className="mt-6 space-y-4">
              {pageLinks.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="hover:text-gold-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="xl:border-l xl:border-white/15 xl:pr-8">
            <h2 className="font-display text-2xl font-medium text-gold-400">Our Services</h2>
            <ul className="mt-6 space-y-4">
              {services.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="hover:text-gold-400">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-center justify-between gap-10 text-center xl:border-l xl:border-white/15 xl:px-6 xl:pt-12">
            <Image src="/theme/roundlogo.png" alt={site.name} width={160} height={169} className="h-auto w-36" />
            {site.footerNote && <p className="font-quote text-2xl leading-[1.75] text-footer-text">“{site.footerNote}”</p>}
            <ul className="flex items-center gap-3">
              {SOCIAL_ORDER.filter((k) => site.social[k]).map((k) => (
                <li key={k}>
                  <a href={site.social[k]} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-full bg-gold-400 text-white transition-colors hover:bg-white hover:text-navy-950">
                    <Icon name={k} className="size-4" label={`${site.name} on ${SOCIAL_LABEL[k]}`} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <ul className="space-y-5 xl:border-l xl:border-white/15 xl:pl-0">
            {site.offices.map((o) => (
              <FooterContact key={o.city} icon="map-pin" title={`Location (${o.city})`}>
                {o.address}
              </FooterContact>
            ))}
            {site.phones.length > 0 && (
              <FooterContact icon="phone" title="Phone">
                {site.phones.map((p) => (
                  <a key={p} href={`tel:${p.replace(/\s+/g, "")}`} className="block hover:text-gold-400">
                    {p}
                  </a>
                ))}
              </FooterContact>
            )}
            <FooterContact icon="mail" title="Email">
              <a href={`mailto:${site.email}`} className="hover:text-gold-400">
                {site.email}
              </a>
            </FooterContact>
          </ul>
        </div>
        <div className="border-t border-white/20">
          <p className="py-7 text-center text-white">
            Copyright © {year} <span className="text-gold-400">{site.name.replace(/\s+/g, " ")}</span>. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterContact({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/5 text-gold-400">
        <Icon name={icon} className="size-5" />
      </span>
      <div className="text-[#d9d9d9]">
        <p className="font-display text-[1.375rem] font-medium text-gold-400">{title}</p>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  );
}
