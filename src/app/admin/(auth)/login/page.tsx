import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/AuthForms";
import { getCurrentUser } from "@/lib/auth/current";
import { safeRedirectPath } from "@/lib/security/request";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const raw = typeof params.next === "string" ? safeRedirectPath(params.next, "") : "";
  const next = raw.startsWith("/admin/") ? raw : undefined;
  if (await getCurrentUser()) redirect(next ?? "/admin/");
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Manage website content and client enquiries.</p>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm">
        <Link href="/admin/forgot-password/" className="text-navy-700 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
