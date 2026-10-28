import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { MenuEditor, type LinkOption } from "@/components/admin/MenuEditor";
import { Card, PageTitle, cx } from "@/components/admin/ui";
import { getDb } from "@/db";
import { documents, menus, pages, services } from "@/db/schema";
import { MENU_KEYS, type MenuKey } from "@/lib/admin/menu-keys";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Menus" };

export default async function MenusPage({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  await requireUserPage("menus.manage");
  const requested = (await searchParams).menu;
  const key: MenuKey = requested && requested in MENU_KEYS ? (requested as MenuKey) : "header";
  const db = await getDb();
  const [[row], svc, docs, pgs] = await Promise.all([
    db.select({ items: menus.items, updatedAt: menus.updatedAt }).from(menus).where(eq(menus.key, key)),
    db.select({ title: services.shortTitle, full: services.title, slug: services.slug }).from(services).orderBy(asc(services.sortOrder)),
    db.select({ title: documents.title, slug: documents.slug }).from(documents).orderBy(asc(documents.sortOrder)),
    db.select({ title: pages.title, path: pages.path }).from(pages).orderBy(asc(pages.title)),
  ]);
  const options: LinkOption[] = [
    ...pgs.map((p) => ({ label: p.title, href: p.path ? `/${p.path}/` : "/", group: "Pages" })),
    ...svc.map((s) => ({ label: s.title || s.full, href: `/service/${s.slug}/`, group: "Services" })),
    ...docs.map((d) => ({ label: d.title, href: `/${d.slug}/`, group: "Legal documents" })),
  ];
  const conf = MENU_KEYS[key];
  return (
    <>
      <PageTitle title="Menus" description="Edit the website's navigation. Changes appear on the site as soon as you save." />
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Menus">
        {(Object.keys(MENU_KEYS) as MenuKey[]).map((k) => (
          <Link key={k} role="tab" aria-selected={k === key} href={`/admin/menus/?menu=${k}`} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", k === key ? "bg-navy-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>
            {MENU_KEYS[k].label}
          </Link>
        ))}
      </div>
      <Card title={conf.label}>
        <p className="mb-4 text-sm text-slate-600">{conf.help}</p>
        {/* key resets the editor's state when switching menus */}
        <MenuEditor key={key} menuKey={key} initial={row?.items ?? []} depth={conf.depth} options={options} />
      </Card>
    </>
  );
}
