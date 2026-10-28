import type { Metadata } from "next";
import { CtaSettingsForm, IntegrationsSettingsForm, SeoSettingsForm, SiteSettingsForm } from "@/components/admin/SettingsForms";
import { Card, PageTitle } from "@/components/admin/ui";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { requireUserPage } from "@/lib/auth/current";
import { DEFAULT_SETTINGS, settingsSchemas, type SettingKey, type Settings } from "@/lib/settings-schema";

export const metadata: Metadata = { title: "Settings" };

/** Current values straight from the database (not the public cache), falling back to defaults. */
async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select().from(settings);
  const out = structuredClone(DEFAULT_SETTINGS) as Settings;
  for (const r of rows) {
    const key = r.key as SettingKey;
    if (!(key in settingsSchemas)) continue;
    const parsed = settingsSchemas[key].safeParse(r.value);
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export default async function SettingsPage() {
  await requireUserPage("settings.manage");
  const s = await loadSettings();
  return (
    <>
      <PageTitle title="Settings" description="Business details, calls to action, integrations and SEO defaults used across the website." />
      <div className="grid gap-6">
        <Card title="Business details">
          <SiteSettingsForm value={s.site} />
        </Card>
        <Card title="Calls to action">
          <CtaSettingsForm value={s.cta} />
        </Card>
        <Card title="Integrations">
          <IntegrationsSettingsForm value={s.integrations} />
        </Card>
        <Card title="SEO defaults">
          <SeoSettingsForm value={s.seo} />
        </Card>
      </div>
    </>
  );
}
