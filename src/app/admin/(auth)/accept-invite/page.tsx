import type { Metadata } from "next";
import { TokenPage } from "@/components/admin/TokenPage";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

export default function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <TokenPage purpose="invite" searchParams={searchParams} />;
}
