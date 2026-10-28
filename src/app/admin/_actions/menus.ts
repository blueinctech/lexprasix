"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { menus, type MenuItem } from "@/db/schema";
import { adminAction } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { MENU_KEYS } from "@/lib/admin/menu-keys";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";

const href = z
  .string()
  .trim()
  .min(1, { error: "Every item needs a link" })
  .max(300)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v) || /^(mailto|tel):[^\s]+$/.test(v), {
    error: "Links must start with / (a page on this site), https://, mailto: or tel:",
  });

type Item = { id: string; label: string; href: string; description?: string; children?: Item[] };

const itemSchema: z.ZodType<Item> = z.lazy(() =>
  z.object({
    id: z.string().trim().min(1).max(60),
    label: z.string().trim().min(1, { error: "Every item needs a label" }).max(80),
    href,
    description: z.string().trim().max(160).optional(),
    children: z.array(itemSchema).max(40).optional(),
  }),
);

function depthOf(items: Item[]): number {
  return items.length ? 1 + Math.max(...items.map((i) => (i.children?.length ? depthOf(i.children) : 0))) : 0;
}

function clean(items: Item[]): MenuItem[] {
  return items.map((i) => ({
    id: i.id,
    label: i.label,
    href: i.href,
    ...(i.description ? { description: i.description } : {}),
    ...(i.children?.length ? { children: clean(i.children) } : {}),
  }));
}

export async function saveMenu(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("menus.manage", async (user) => {
    const key = String(fd.get("key") ?? "") as keyof typeof MENU_KEYS;
    const conf = MENU_KEYS[key];
    if (!conf) return fail("Unknown menu.");
    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("items") ?? "[]"));
    } catch {
      return fail("The menu could not be read. Reload the page and try again.");
    }
    const parsed = z.array(itemSchema).max(40).safeParse(raw);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the menu items.");
    if (depthOf(parsed.data) > conf.depth) return fail(conf.depth === 1 ? "This menu can't have sub-items." : `This menu supports at most ${conf.depth} levels.`);
    const items = clean(parsed.data);
    const db = await getDb();
    const [existing] = await db.select({ key: menus.key }).from(menus).where(eq(menus.key, key));
    if (existing) await db.update(menus).set({ items, updatedById: user.id }).where(eq(menus.key, key));
    else await db.insert(menus).values({ key, label: conf.label, items, updatedById: user.id });
    await audit({ userId: user.id, action: "menu.update", entityType: "menu", entityId: key });
    refreshPublic("menus");
    return ok("Menu saved. The website now shows the new menu.");
  });
}
