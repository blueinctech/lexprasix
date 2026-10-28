"use server";

import { z } from "zod";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { adminAction, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { settingsSchemas, type SettingKey } from "@/lib/settings-schema";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const lines = (v: string) =>
  v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Builds the value for one settings key from its form. */
function valueFrom(key: SettingKey, fd: FormData): unknown {
  switch (key) {
    case "site": {
      let offices: unknown = [];
      try {
        offices = JSON.parse(str(fd, "offices") || "[]");
      } catch {
        offices = null;
      }
      return {
        name: str(fd, "name"),
        legalName: str(fd, "legalName"),
        tagline: str(fd, "tagline"),
        email: str(fd, "email"),
        phones: lines(str(fd, "phones")),
        whatsapp: str(fd, "whatsapp"),
        offices,
        hours: str(fd, "hours"),
        social: {
          instagram: str(fd, "social.instagram"),
          linkedin: str(fd, "social.linkedin"),
          youtube: str(fd, "social.youtube"),
          facebook: str(fd, "social.facebook"),
          x: str(fd, "social.x"),
        },
        footerNote: str(fd, "footerNote"),
      };
    }
    case "cta":
      return { headerLabel: str(fd, "headerLabel"), headerHref: str(fd, "headerHref"), consultationTitle: str(fd, "consultationTitle"), consultationText: str(fd, "consultationText") };
    case "integrations":
      return {
        gtmId: str(fd, "gtmId").toUpperCase(),
        calendlyUrl: str(fd, "calendlyUrl"),
        tawkPropertyId: str(fd, "tawkPropertyId"),
        tawkEnabled: fd.get("tawkEnabled") === "on",
        whatsappEnabled: fd.get("whatsappEnabled") === "on",
        trustindexWidgetId: str(fd, "trustindexWidgetId"),
        googleSiteVerification: str(fd, "googleSiteVerification"),
      };
    case "seo":
      return { homeTitle: str(fd, "homeTitle"), titleSuffix: String(fd.get("titleSuffix") ?? ""), defaultDescription: str(fd, "defaultDescription"), defaultOgImageUrl: str(fd, "defaultOgImageUrl") };
  }
}

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (user) => {
    const key = str(fd, "key") as SettingKey;
    if (!(key in settingsSchemas)) return fail("Unknown settings section.");
    const raw = valueFrom(key, fd);
    const parsed = (settingsSchemas[key] as z.ZodType).safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    if (key === "cta") {
      const href = (parsed.data as { headerHref: string }).headerHref;
      if (!(href.startsWith("/") && !href.startsWith("//")) && !/^https:\/\//.test(href)) return fail("The button link must start with / or https://", { headerHref: "Start with / or https://" });
    }
    const db = await getDb();
    await db.insert(settings).values({ key, value: parsed.data, updatedById: user.id }).onConflictDoUpdate({ target: settings.key, set: { value: parsed.data, updatedById: user.id } });
    await audit({ userId: user.id, action: "settings.update", entityType: "settings", entityId: key });
    refreshPublic("settings");
    return ok("Settings saved. The website uses them from the next page view.");
  });
}
