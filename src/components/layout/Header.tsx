import Link from "next/link";
import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { getMenu, getSettings, TAGS } from "@/lib/content/queries";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink, Container } from "@/components/ui/primitives";
import { DesktopNav, MobileNav } from "./Nav";

export async function Header() {
  "use cache";
  cacheTag(TAGS.settings, TAGS.menus);
  cacheLife("days");
  const [settings, items] = await Promise.all([getSettings(), getMenu("header")]);
  const { site, cta } = settings;
  const phone = site.phones[0];
  return (
    <header className="relative z-30">
      <div className="hidden bg-navy-950 text-[0.8rem] text-white/75 md:block">
        <Container className="flex h-10 items-center justify-between gap-6">
          <p className="truncate">{site.offices.map((o) => o.city).join(" · ")} — {site.tagline}</p>
          <div className="flex shrink-0 items-center gap-5">
            {phone && (
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 hover:text-white">
                <Icon name="phone" className="size-3.5" /> {phone}
              </a>
            )}
            <a href={`mailto:${site.email}`} className="flex items-center gap-2 hover:text-white">
              <Icon name="mail" className="size-3.5" /> {site.email}
            </a>
          </div>
        </Container>
      </div>
      <div className="border-b border-line/80 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <Container className="flex h-[4.75rem] items-center justify-between gap-6">
          <Link href="/" aria-label={`${site.name} home`} className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-3">
            {/* The interactive menu reads the current URL; plain links render until it hydrates. */}
            <Suspense
              fallback={
                <ul className="hidden items-center gap-1 lg:flex">
                  {items.map((i) => (
                    <li key={i.id}>
                      <Link href={i.href} className="rounded-full px-3.5 py-2 text-[0.94rem] text-ink/80 hover:text-gold-700">
                        {i.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              }
            >
              <DesktopNav items={items} />
            </Suspense>
            {/* The wrapper carries the breakpoint; the button's own inline-flex would override "hidden". */}
            <span className="hidden sm:block">
              <ButtonLink href={cta.headerHref} size="md">
                {cta.headerLabel}
              </ButtonLink>
            </span>
            <Suspense fallback={<span className="size-11 rounded-full border border-line lg:hidden" aria-hidden="true" />}>
              <MobileNav items={items} cta={{ label: cta.headerLabel, href: cta.headerHref }} phone={phone} />
            </Suspense>
          </nav>
        </Container>
      </div>
    </header>
  );
}
