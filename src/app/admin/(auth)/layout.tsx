import { Suspense, type ReactNode } from "react";
import { LogoMark } from "@/components/ui/Logo";

// Signed-out pages: sign in, forgot password, reset password, accept invite.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-white">
          <LogoMark className="h-10 w-auto" />
          <span className="font-display text-xl">LexPraxis admin</span>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>{children}</Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-white/50">Authorised staff only. Activity is logged.</p>
      </div>
    </div>
  );
}
