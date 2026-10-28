import type { Metadata } from "next";
import { TokenPage } from "@/components/admin/TokenPage";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <TokenPage purpose="reset" searchParams={searchParams} />;
}
