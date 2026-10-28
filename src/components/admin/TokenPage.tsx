import Link from "next/link";
import { inspectToken, type TokenPurpose } from "@/lib/auth/tokens";
import { SetPasswordForm } from "./AuthForms";

// Shared by /admin/reset-password/ and /admin/accept-invite/.
export async function TokenPage({ purpose, searchParams }: { purpose: TokenPurpose; searchParams: Promise<{ token?: string }> }) {
  const token = String((await searchParams).token ?? "");
  const info = await inspectToken(purpose, token);
  const title = purpose === "reset" ? "Choose a new password" : "Accept your invitation";
  if (!info) {
    return (
      <>
        <h1 className="text-xl font-semibold text-slate-900">Link expired</h1>
        <p className="mt-2 text-sm text-slate-600">This link is invalid, already used or expired.</p>
        <p className="mt-6 text-sm">
          <Link href="/admin/forgot-password/" className="text-navy-700 hover:underline">
            Request a new link
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {info.name} · {info.email}
      </p>
      <SetPasswordForm purpose={purpose} token={token} />
    </>
  );
}
