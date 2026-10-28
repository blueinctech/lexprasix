import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { count, eq } from "drizzle-orm";
import { logout } from "@/app/admin/_actions/auth";
import { AdminNav, type NavItem } from "@/components/admin/ui";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/Logo";
import { getDb } from "@/db";
import { emailOutbox, submissions } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";

// Signed-in admin chrome. requireUserPage() redirects to the sign-in page when
// there's no valid session; each page and action checks its own permission.

const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/admin/", label: "Dashboard", icon: "home", permission: "dashboard.view" },
  { href: "/admin/submissions/", label: "Enquiries", icon: "mail", permission: "submissions.view", group: "Clients" },
  { href: "/admin/posts/", label: "Blog posts", icon: "file-text", permission: "posts.edit_own", group: "Content" },
  { href: "/admin/pages/", label: "Pages", icon: "file-text", permission: "pages.manage", group: "Content" },
  { href: "/admin/services/", label: "Services", icon: "scale", permission: "services.manage", group: "Content" },
  { href: "/admin/documents/", label: "Legal documents", icon: "contract", permission: "documents.manage", group: "Content" },
  { href: "/admin/testimonials/", label: "Testimonials", icon: "quote", permission: "pages.manage", group: "Content" },
  { href: "/admin/taxonomies/", label: "Categories & tags", icon: "badge", permission: "taxonomies.manage", group: "Content" },
  { href: "/admin/media/", label: "Media library", icon: "upload", permission: "media.upload", group: "Content" },
  { href: "/admin/menus/", label: "Menus", icon: "menu", permission: "menus.manage", group: "Site" },
  { href: "/admin/redirects/", label: "Redirects", icon: "arrow-up-right", permission: "redirects.manage", group: "Site" },
  { href: "/admin/settings/", label: "Settings", icon: "sparkle", permission: "settings.manage", group: "Site" },
  { href: "/admin/users/", label: "Users", icon: "user", permission: "users.manage", group: "System" },
  { href: "/admin/emails/", label: "Email log", icon: "mail", permission: "email.view", group: "System" },
  { href: "/admin/activity/", label: "Activity log", icon: "clock", permission: "audit.view", group: "System" },
];

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUserPage();
  const db = await getDb();
  const [[{ n: newEnquiries }], [{ n: failedEmails }]] = await Promise.all([
    can(user.role, "submissions.view") ? db.select({ n: count() }).from(submissions).where(eq(submissions.status, "new")) : Promise.resolve([{ n: 0 }]),
    can(user.role, "email.view") ? db.select({ n: count() }).from(emailOutbox).where(eq(emailOutbox.status, "failed")) : Promise.resolve([{ n: 0 }]),
  ]);
  const items = NAV.filter((i) => can(user.role, i.permission)).map((i) => ({
    href: i.href,
    label: i.label,
    icon: i.icon,
    group: i.group,
    count: i.href === "/admin/submissions/" ? newEnquiries : i.href === "/admin/emails/" ? failedEmails : undefined,
  }));

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15.5rem_1fr]">
      <aside className="flex flex-col bg-navy-950 px-3 py-5 text-slate-300 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
        <Link href="/admin/" className="mb-6 flex items-center gap-2.5 px-3 text-white">
          <LogoMark className="h-8 w-auto" />
          <span className="leading-tight">
            <span className="block font-display text-base">LexPraxis</span>
            <span className="block text-[0.68rem] tracking-wide text-slate-400">Website admin</span>
          </span>
        </Link>
        <AdminNav items={items} />
        <div className="mt-auto border-t border-white/10 px-3 pt-4 text-xs">
          <p className="truncate font-medium text-white">{user.name}</p>
          <p className="text-slate-400">{ROLE_LABELS[user.role]}</p>
          <div className="mt-3 flex items-center gap-4">
            <a href="/" target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-white">
              View site <Icon name="external" className="size-3" />
            </a>
            <form action={logout}>
              <button type="submit" className="hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
