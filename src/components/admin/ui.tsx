import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

// Admin UI kit. Server-safe helpers and presentational components live here;
// interactive pieces (forms, inputs, navigation) are in ui-client.tsx and
// re-exported below, so every admin file imports from "@/components/admin/ui".
// Calm SaaS styling: white cards on a cool-grey canvas, navy primary actions.

export {
  ActionForm,
  ActionMessage,
  AdminNav,
  Checkbox,
  Field,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
  type FormAction,
  type NavItem,
} from "./ui-client";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const BTN: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-700",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-slate-700 hover:bg-slate-100",
};

export function btn(variant: ButtonVariant = "primary", small = false) {
  return cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none", small ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm", BTN[variant]);
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function PageTitle({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
            <Icon name="arrow-left" className="size-3.5" /> {back.label}
          </Link>
        )}
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  published: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  draft: "bg-slate-100 text-slate-700 ring-slate-500/20",
  scheduled: "bg-amber-50 text-amber-800 ring-amber-600/20",
  new: "bg-blue-50 text-blue-800 ring-blue-600/20",
  in_progress: "bg-amber-50 text-amber-800 ring-amber-600/20",
  awaiting_client: "bg-violet-50 text-violet-800 ring-violet-600/20",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  archived: "bg-slate-100 text-slate-600 ring-slate-500/20",
  spam: "bg-red-50 text-red-800 ring-red-600/20",
  sent: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  pending: "bg-slate-100 text-slate-700 ring-slate-500/20",
  sending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  failed: "bg-red-50 text-red-800 ring-red-600/20",
  skipped: "bg-slate-100 text-slate-600 ring-slate-500/20",
  administrator: "bg-navy-50 text-navy-900 ring-navy-700/20",
  editor: "bg-slate-100 text-slate-700 ring-slate-500/20",
  author: "bg-slate-100 text-slate-700 ring-slate-500/20",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={cx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", BADGE[value] ?? BADGE.draft)}>{label ?? value.replace(/_/g, " ")}</span>;
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-14 text-center">
      <Icon name="file-text" className="size-8 text-slate-300" />
      <p className="font-medium text-slate-900">{title}</p>
      {text && <p className="max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Server-rendered pager: `href(n)` runs on the server, so no function crosses to the client. */
export function Pager({ page, pages, href }: { page: number; pages: number; href: (n: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <span>
        Page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link className={btn("secondary", true)} href={href(page - 1)}>
            Previous
          </Link>
        )}
        {page < pages && (
          <Link className={btn("secondary", true)} href={href(page + 1)}>
            Next
          </Link>
        )}
      </span>
    </div>
  );
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }).format(new Date(d));
}
