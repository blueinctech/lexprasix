import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { VerifyForm } from "@/components/admin/AuthForms";
import { getCurrentUser } from "@/lib/auth/current";
import { hasActiveChallenge } from "@/lib/auth/two-factor";

export const metadata: Metadata = { title: "Two-factor authentication" };

// Second sign-in step for accounts with 2FA. The challenge cookie set after the password says who is signing in.
export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (await getCurrentUser()) redirect("/admin/");
  const recovery = (await searchParams).recovery === "1";
  if (!(await hasActiveChallenge())) {
    return (
      <>
        <h1 className="text-xl font-semibold text-slate-900">Sign-in expired</h1>
        <p className="mt-2 text-sm text-slate-600">For your security, the code step lasts 5 minutes and allows a few attempts. Please sign in again.</p>
        <p className="mt-6 text-sm">
          <Link href="/admin/login/" className="text-navy-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Two-factor authentication</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {recovery ? "Enter one of your recovery codes. Each code works once." : "Enter the 6-digit code from your authenticator app."}
      </p>
      <VerifyForm key={recovery ? "recovery" : "totp"} recovery={recovery} />
      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href={recovery ? "/admin/login/verify/" : "/admin/login/verify/?recovery=1"} className="text-navy-700 hover:underline">
          {recovery ? "Use your authenticator app" : "Use a recovery code instead"}
        </Link>
        <Link href="/admin/login/" className="text-slate-500 hover:underline">
          Back to sign in
        </Link>
      </div>
    </>
  );
}
