"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { MenuItem } from "@/db/schema";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/primitives";

// Desktop: dropdowns open on hover or click, close on Escape / outside click.
// Items with grandchildren render as a multi-column mega panel.
// Mobile: full-height drawer with expandable sections.

export function DesktopNav({ items }: { items: MenuItem[] }) {
  const pathname = usePathname();
  // A dropdown belongs to the page it was opened on, so navigating closes it.
  const [openState, setOpenState] = useState<{ id: string; path: string } | null>(null);
  const open = openState?.path === pathname ? openState.id : null;
  const setOpen = (id: string | null) => setOpenState(id ? { id, path: pathname } : null);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
    // setOpen only ever closes here; recreating listeners per render is unnecessary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = (id: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(id);
  };
  const leave = () => {
    closeTimer.current = setTimeout(() => setOpen(null), 160);
  };

  return (
    <div ref={ref} className="hidden items-center gap-1 lg:flex">
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        if (!item.children?.length) {
          return (
            <Link key={item.id} href={item.href} aria-current={pathname === item.href ? "page" : undefined} className={`rounded-full px-3.5 py-2 text-[0.94rem] transition-colors hover:text-gold-700 ${active ? "text-navy-950 font-medium" : "text-ink/80"}`}>
              {item.label}
            </Link>
          );
        }
        const mega = item.children.some((c) => c.children?.length);
        const isOpen = open === item.id;
        return (
          <div key={item.id} className="relative" onMouseEnter={() => enter(item.id)} onMouseLeave={leave}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`menu-${item.id}`}
              onClick={() => setOpen(isOpen ? null : item.id)}
              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-[0.94rem] transition-colors hover:text-gold-700 ${active || isOpen ? "text-navy-950 font-medium" : "text-ink/80"}`}
            >
              {item.label}
              <Icon name="chevron-down" className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <div
              id={`menu-${item.id}`}
              hidden={!isOpen}
              className={`absolute top-full z-40 pt-3 ${mega ? "left-1/2 -translate-x-1/2" : "left-0"}`}
            >
              <div className={`rounded-2xl border border-line bg-white p-6 shadow-[0_24px_60px_-20px_rgba(11,22,48,.25)] ${mega ? "w-[min(52rem,90vw)]" : "w-[34rem]"}`}>
                {mega ? (
                  <div className="grid grid-cols-2 gap-8">
                    {item.children.map((group) => (
                      <div key={group.id}>
                        <Link href={group.href} className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase hover:text-navy-900">
                          {group.label}
                          <Icon name="arrow-right" className="size-3.5" />
                        </Link>
                        <ul className="grid gap-0.5">
                          {group.children?.map((c) => (
                            <li key={c.id}>
                              <Link href={c.href} className="block rounded-lg px-2.5 py-1.5 text-[0.92rem] text-ink/85 hover:bg-paper-warm hover:text-navy-950">
                                {c.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <ul className="grid grid-cols-2 gap-0.5">
                      {item.children.map((c) => (
                        <li key={c.id}>
                          <Link href={c.href} className="block rounded-lg px-2.5 py-2 text-[0.92rem] text-ink/85 hover:bg-paper-warm hover:text-navy-950">
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link href={item.href} className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm font-medium text-navy-900 hover:text-gold-700">
                      View all {item.label.toLowerCase()} <Icon name="arrow-right" className="size-4" />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MobileNav({ items, cta, phone }: { items: MenuItem[]; cta: { label: string; href: string }; phone?: string }) {
  const pathname = usePathname();
  // Open for the page it was opened on; navigating closes the drawer.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const [section, setSection] = useState<string | null>(null);
  const panelId = useId();
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls={panelId} className="grid size-11 place-items-center rounded-full border border-line text-navy-900">
        <Icon name="menu" className="size-5" label="Open menu" />
      </button>
      <div id={panelId} role="dialog" aria-modal="true" aria-label="Site menu" hidden={!open} className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
        <div className="ml-auto flex h-full w-full max-w-sm flex-col bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-display text-lg text-navy-950">Menu</span>
            <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full border border-line">
              <Icon name="x" className="size-5" label="Close menu" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile">
            <ul>
              <li>
                <Link href="/" className="block rounded-lg px-3 py-3 text-lg text-navy-950">
                  Home
                </Link>
              </li>
              {items.map((item) => (
                <li key={item.id} className="border-t border-line/70">
                  {item.children?.length ? (
                    <>
                      <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-lg text-navy-950" aria-expanded={section === item.id} onClick={() => setSection(section === item.id ? null : item.id)}>
                        {item.label}
                        <Icon name="chevron-down" className={`size-5 transition-transform ${section === item.id ? "rotate-180" : ""}`} />
                      </button>
                      <div hidden={section !== item.id} className="pb-3">
                        <Link href={item.href} className="block px-5 py-2 text-sm font-medium text-gold-700">
                          All {item.label.toLowerCase()}
                        </Link>
                        {item.children.map((c) =>
                          c.children?.length ? (
                            <div key={c.id} className="mt-2">
                              <p className="px-5 pt-2 pb-1 text-xs font-semibold tracking-[0.16em] text-ink-muted uppercase">{c.label}</p>
                              {c.children.map((g) => (
                                <Link key={g.id} href={g.href} className="block px-5 py-2 text-[0.95rem] text-ink/85">
                                  {g.label}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <Link key={c.id} href={c.href} className="block px-5 py-2 text-[0.95rem] text-ink/85">
                              {c.label}
                            </Link>
                          ),
                        )}
                      </div>
                    </>
                  ) : (
                    <Link href={item.href} className="block rounded-lg px-3 py-3 text-lg text-navy-950">
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <div className="grid gap-3 border-t border-line p-5">
            <Link href={cta.href} className={buttonClass("primary", "lg")}>
              {cta.label}
            </Link>
            {phone && (
              <a href={`tel:${phone.replace(/\s+/g, "")}`} className={buttonClass("outline", "lg")}>
                <Icon name="phone" className="size-4" /> {phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
