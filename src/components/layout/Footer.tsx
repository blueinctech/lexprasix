import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { getMenu, getSettings, TAGS } from "@/lib/content/queries";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { Container } from "@/components/ui/primitives";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

const SOCIAL_LABEL: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", facebook: "Facebook", x: "X" };

export async function Footer() {
  "use cache";
  cacheTag(TAGS.settings, TAGS.menus);
  cacheLife("days");
  const [settings, services, company, legal] = await Promise.all([getSettings(), getMenu("footer-services"), getMenu("footer-company"), getMenu("footer-legal")]);
  const { site } = settings;
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-navy-950 text-white/75">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" aria-hidden="true" />
      <Container className="grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-4">
          <Logo inverted />
          {site.footerNote && <p className="mt-6 max-w-sm font-display text-xl leading-snug text-white/90">“{site.footerNote}”</p>}
          <div className="mt-8">
            <p className="text-sm font-medium text-white">Legal updates in your inbox</p>
            <p className="mt-1 text-sm text-white/60">Occasional guides on Nigerian business law. Unsubscribe anytime.</p>
            <NewsletterForm />
          </div>
        </div>
        <FooterColumn title="Services" items={services} className="lg:col-span-3" />
        <FooterColumn title="The firm" items={company} className="lg:col-span-2" />
        <div className="lg:col-span-3">
          <h2 className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">Offices</h2>
          <ul className="mt-5 space-y-4 text-sm">
            {site.offices.map((o) => (
              <li key={o.city}>
                <p className="font-medium text-white">{o.city}</p>
                <p className="text-white/65">{o.address}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-6 space-y-2 text-sm">
            {site.phones.map((p) => (
              <li key={p}>
                <a href={`tel:${p.replace(/\s+/g, "")}`} className="inline-flex items-center gap-2 hover:text-white">
                  <Icon name="phone" className="size-4 text-gold-300" /> {p}
                </a>
              </li>
            ))}
            <li>
              <a href={`mailto:${site.email}`} className="inline-flex items-center gap-2 hover:text-white">
                <Icon name="mail" className="size-4 text-gold-300" /> {site.email}
              </a>
            </li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-4 py-6 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.legalName || site.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {legal.map((l) => (
              <li key={l.id}>
                <Link href={l.href} className="hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className="flex items-center gap-2">
            {Object.entries(site.social)
              .filter(([, url]) => url)
              .map(([key, url]) => (
                <li key={key}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-full border border-white/15 text-white/70 hover:border-gold-300 hover:text-white">
                    <Icon name={key} className="size-4" label={`${site.name} on ${SOCIAL_LABEL[key] ?? key}`} />
                  </a>
                </li>
              ))}
          </ul>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items, className }: { title: string; items: { id: string; label: string; href: string }[]; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">{title}</h2>
      <ul className="mt-5 space-y-2.5 text-sm">
        {items.map((i) => (
          <li key={i.id}>
            <Link href={i.href} className="hover:text-white">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
