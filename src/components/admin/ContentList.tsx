import Link from "next/link";
import type { ReactNode } from "react";

// Server-rendered list toolbar (GET form, works without JavaScript) and table shell.

export function ListFilters({ action, q, children }: { action: string; q?: string; children?: ReactNode }) {
  return (
    <form action={action} method="get" role="search" className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-3">
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        Search
        <input type="search" name="q" defaultValue={q} placeholder="Search…" className="h-9 w-64 rounded-lg border border-slate-300 px-3 text-sm focus:border-navy-700 focus:outline-none" />
      </label>
      {children}
      <button type="submit" className="h-9 rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700">
        Filter
      </button>
      <Link href={action} className="h-9 content-center text-sm text-slate-500 hover:text-slate-900">
        Reset
      </Link>
    </form>
  );
}

export function FilterSelect({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <select name={name} defaultValue={value ?? ""} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:border-navy-700 focus:outline-none">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-5 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Flash({ params }: { params: Record<string, string | string[] | undefined> }) {
  const msg = params.created ? "Created." : params.deleted ? "Deleted." : params.restored ? "Earlier version restored. Review it, then save to keep it." : null;
  if (!msg) return null;
  return (
    <p role="status" className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      {msg}
    </p>
  );
}

export const STATUS_OPTIONS = [
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Draft" },
];

export function qs(base: string, params: Record<string, string | undefined>, page: number) {
  const sp = new URLSearchParams(Object.entries({ ...params, page: page > 1 ? String(page) : undefined }).filter((e): e is [string, string] => Boolean(e[1])));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** Server-rendered pagination (the UI kit's Pager takes a function, which server pages can't pass). */
export function ListPager({ base, params, page, pages }: { base: string; params: Record<string, string | undefined>; page: number; pages: number }) {
  if (pages <= 1) return null;
  const cls = "inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <span>
        Page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link className={cls} href={qs(base, params, page - 1)} rel="prev">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link className={cls} href={qs(base, params, page + 1)} rel="next">
            Next
          </Link>
        )}
      </span>
    </nav>
  );
}
