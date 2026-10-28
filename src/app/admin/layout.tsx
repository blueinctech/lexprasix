import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

// The admin has its own chrome and is never indexed. Every admin route reads
// the session cookie at request time, so navigations may block, and this
// boundary keeps those request-time reads out of the static shell.
export const instant = false;

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · LexPraxis admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 font-sans text-[0.94rem] text-slate-900">
      <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>{children}</Suspense>
    </div>
  );
}
