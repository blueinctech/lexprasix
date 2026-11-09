import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { getMenu, getSettings, TAGS } from "@/lib/content/queries";
import { Icon } from "@/components/ui/Icon";
import { DesktopNav, MobileNav } from "./Nav";

// Matches the WordPress (Ensaf) header: navy top bar with contact details and
// social icons, a light-grey logo panel with a gold edge spanning both rows,
// navy navigation, a round search button and the gold consultation pill.

const SOCIAL_ORDER = ["facebook", "instagram", "linkedin", "youtube", "x"] as const;
const SOCIAL_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", x: "X" };

/** "+234 916 054 6551" → "09160546551", as printed in the theme's top bar. */
function localPhone(p: string) {
  return p.replace(/\s+/g, "").replace(/^\+234/, "0");
}

export async function Header() {
  "use cache";
  cacheTag(TAGS.settings, TAGS.menus);
  cacheLife("days");
  const [settings, items] = await Promise.all([getSettings(), getMenu("header")]);
  const { site, cta } = settings;
  const lagos = site.offices[0];
  return (
    <header className="relative z-30 bg-white">
      {/* Logo panel (desktop): spans the top bar and the navigation row. */}
      <Link
        href="/"
        aria-label={`${site.name} home`}
        className="absolute top-0 left-0 z-10 hidden h-[9.75rem] w-[18.75rem] items-center justify-center rounded-br-[3.75rem] border-r border-b border-gold-400 bg-paper-warm xl:flex"
      >
        <Image src="/theme/lexpraxis-logo.png" alt={site.name} width={220} height={73} loading="eager" className="h-auto w-[12.5rem]" />
      </Link>

      <div className="hidden bg-navy-700 text-[0.94rem] text-white xl:block">
        <div className="flex h-12 items-center justify-between pr-[3.75rem] pl-[19.25rem]">
          <ul className="flex items-center gap-5">
            {site.phones.length > 0 && (
              <li className="flex items-center gap-2">
                <Icon name="phone" className="size-4" />
                <a href={`tel:${site.phones[0].replace(/\s+/g, "")}`} className="hover:text-gold-300">
                  {site.phones.map(localPhone).join(", ")}
                </a>
              </li>
            )}
            <li aria-hidden="true" className="text-white/70">|</li>
            <li className="flex items-center gap-2">
              <Icon name="mail" className="size-4" />
              <a href={`mailto:${site.email}`} className="hover:text-gold-300">
                {site.email}
              </a>
            </li>
            {lagos && (
              <>
                <li aria-hidden="true" className="text-white/70">|</li>
                <li className="flex items-center gap-2">
                  <Icon name="map-pin" className="size-4" />
                  {lagos.address.replace(/, (Lagos)$/, " $1")}
                </li>
              </>
            )}
          </ul>
          <ul className="flex items-center gap-4">
            {SOCIAL_ORDER.filter((k) => site.social[k]).map((k) => (
              <li key={k}>
                <a href={site.social[k]} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300">
                  <Icon name={k} className="size-[1.125rem]" label={`${site.name} on ${SOCIAL_LABEL[k]}`} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-b border-line">
        <div className="flex h-[4.5rem] items-center justify-between gap-6 px-4 sm:px-6 xl:h-[6.75rem] xl:pr-[3.75rem] xl:pl-[21.5rem]">
          <Link href="/" aria-label={`${site.name} home`} className="shrink-0 xl:hidden">
            <Image src="/theme/lexpraxis-logo.png" alt={site.name} width={165} height={54} loading="eager" className="h-auto w-[9.5rem] sm:w-[10.5rem]" />
          </Link>
          <nav aria-label="Main" className="flex flex-1 items-center justify-end gap-3 xl:justify-between">
            <Suspense
              fallback={
                <ul className="hidden items-center gap-1 xl:flex">
                  {items.map((i) => (
                    <li key={i.id}>
                      <Link href={i.href} className="px-3 py-2 text-base font-semibold text-navy-700">
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              }
            >
              <DesktopNav items={items} />
            </Suspense>
            <div className="flex items-center gap-3">
              <Link href="/blog/search/" className="hidden size-14 place-items-center rounded-full border border-line text-heading transition-colors hover:border-gold-500 hover:text-gold-500 sm:grid">
                <Icon name="search" className="size-5" label="Search" />
              </Link>
              {/* The wrapper carries the breakpoint; the button's own inline-flex would override "hidden". */}
              <span className="hidden sm:block">
                <Link href={cta.headerHref} className="inline-flex h-14 items-center gap-2 rounded-full bg-gold-500 px-8 text-[0.875rem] font-semibold text-white transition-colors hover:bg-navy-700">
                  {cta.headerLabel.replace(/\b\w/g, (c) => c.toUpperCase())}
                  <Icon name="arrow-right" className="size-4" />
                </Link>
              </span>
              <Suspense fallback={<span className="size-11 rounded-full border border-line xl:hidden" aria-hidden="true" />}>
                <MobileNav items={items} cta={{ label: cta.headerLabel, href: cta.headerHref }} phone={site.phones[0]} />
              </Suspense>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
