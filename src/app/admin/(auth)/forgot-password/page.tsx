import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/admin/AuthForms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">Enter your work email and we&apos;ll send you a reset link.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/admin/login/" className="text-navy-700 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
