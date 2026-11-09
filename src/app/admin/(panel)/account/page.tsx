import type { Metadata } from "next";
import { ChangePasswordForm, TwoFactorPanel } from "@/components/admin/AccountForms";
import { Badge, Card, formatDateTime, PageTitle } from "@/components/admin/ui";
import { requireUserPage } from "@/lib/auth/current";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { pendingSetup, twoFactorStatus } from "@/lib/auth/two-factor";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUserPage();
  const status = await twoFactorStatus(user.id);
  const setup = status.pending ? await pendingSetup(user) : null;
  return (
    <>
      <PageTitle title="My account" description="Your sign-in details and security." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div id="two-factor" className="grid scroll-mt-6 content-start gap-6">
          <Card title="Two-factor authentication" actions={<Badge value={status.enabled ? "active" : "inactive"} label={status.enabled ? "On" : "Off"} />}>
            <TwoFactorPanel status={{ enabled: status.enabled, enabledAt: status.enabledAt ? formatDateTime(status.enabledAt) : null, recoveryCodesLeft: status.recoveryCodesLeft }} setup={setup} />
          </Card>
          <Card title="Change password">
            <ChangePasswordForm />
          </Card>
        </div>
        <Card title="Profile">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="break-all text-slate-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd>{ROLE_LABELS[user.role]}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">To change your name, email or role, ask an administrator.</p>
        </Card>
      </div>
    </>
  );
}
