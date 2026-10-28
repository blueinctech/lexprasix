import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { DeleteRedirectForm, RedirectForm } from "@/components/admin/RedirectForms";
import { Card, formatDateTime, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { redirects } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Edit redirect" };

export default async function RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUserPage("redirects.manage");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [r] = await db.select().from(redirects).where(eq(redirects.id, id));
  if (!r) notFound();
  return (
    <>
      <PageTitle title={r.source} description={`${r.hits} hit${r.hits === 1 ? "" : "s"} · last used ${formatDateTime(r.lastHitAt)} · created ${formatDateTime(r.createdAt)}`} back={{ href: "/admin/redirects/", label: "Redirects" }} />
      <div className="grid gap-6">
        <Card title="Redirect">
          <RedirectForm value={{ id: r.id, source: r.source, destination: r.destination, statusCode: r.statusCode, note: r.note }} />
        </Card>
        <Card title="Delete">
          <DeleteRedirectForm id={r.id} />
        </Card>
      </div>
    </>
  );
}
