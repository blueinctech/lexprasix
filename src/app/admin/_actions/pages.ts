"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { pages, type Block } from "@/db/schema";
import { adminAction, formObject, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { addSlugRedirect, cleanSlug, jsonField, normaliseMediaHtml, parseSeo, parseStatus, rootSlugConflict, uuidOrNull } from "@/lib/admin/editing";
import { saveRevision } from "@/lib/admin/revisions";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { BLOCK_LABELS, blockSchema, type BlockType } from "@/lib/blocks";
import { sanitizeRichHtml } from "@/lib/sanitize";

const EDITABLE_TEMPLATES = ["default", "contact", "booking", "legal", "reviews", "landing"] as const;

const base = z.object({
  title: z.string().trim().min(1, { error: "Enter a title" }).max(200),
  summary: z.string().trim().max(600).default(""),
});

/** Validates page blocks; rich text is sanitised and uploads made root-relative. */
function parsePageBlocks(raw: unknown): { ok: true; blocks: Block[] } | { ok: false; error: string } {
  const input = jsonField<unknown[]>(raw, []);
  if (!Array.isArray(input) || input.length > 60) return { ok: false, error: "The page has too many blocks." };
  const out: Block[] = [];
  for (const [i, item] of input.entries()) {
    const b = item as Record<string, unknown>;
    if (b?.type === "hero" && b.imageId === "") b.imageId = null;
    if (b?.type === "hero" && Array.isArray(b.points)) b.points = (b.points as string[]).map((p) => String(p).trim()).filter(Boolean);
    const parsed = blockSchema.safeParse(b);
    if (!parsed.success) {
      const label = BLOCK_LABELS[b?.type as BlockType] ?? "Unknown";
      const issue = parsed.error.issues[0];
      return { ok: false, error: `Block ${i + 1} (${label}): ${issue.path.join(".") || "block"} — ${issue.message}` };
    }
    const data = parsed.data as Block;
    if (data.type === "richText") data.html = normaliseMediaHtml(sanitizeRichHtml(String(data.html ?? "")));
    out.push(data);
  }
  return { ok: true, blocks: out };
}

export async function savePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("pages.manage", async (user) => {
    const form = formObject(fd);
    const id = uuidOrNull(form.id);
    const parsed = base.safeParse({ title: form.title, summary: form.summary ?? "" });
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [prev] = id ? await db.select().from(pages).where(eq(pages.id, id)) : [];
    if (id && !prev) return fail("This page no longer exists.");

    const isIndex = prev?.template === "index";
    const isHome = prev?.path === "";
    // The homepage and index routes keep their fixed URLs.
    const path = isHome || isIndex ? prev!.path : cleanSlug(form.slug, parsed.data.title);
    if (!isHome && !isIndex) {
      const conflict = await rootSlugConflict(path, { type: "page", id });
      if (conflict) return fail(conflict, { slug: conflict });
    }
    const template = prev && (isIndex || prev.template === "home") ? prev.template : EDITABLE_TEMPLATES.includes(form.template as never) ? String(form.template) : "default";

    let blocks: Block[] = prev?.blocks ?? [];
    if (!isIndex) {
      const b = parsePageBlocks(form.blocks);
      if (!b.ok) return fail(b.error);
      blocks = b.blocks;
    }
    const st = parseStatus(form, { canPublish: true, existing: prev ?? undefined });
    if (!st.ok) return fail(st.error);
    if (isHome && st.status !== "published") return fail("The homepage must stay published.");

    const values = {
      title: parsed.data.title,
      summary: parsed.data.summary,
      path,
      template,
      blocks,
      featuredImageId: uuidOrNull(form.featuredImageId),
      status: st.status,
      publishedAt: st.publishedAt,
      seo: parseSeo(form, prev?.seo),
      updatedById: user.id,
    };

    const pageId = await db.transaction(async (tx) => {
      if (prev) {
        await saveRevision("page", prev.id, prev as unknown as Record<string, unknown>, user.id, tx);
        await tx.update(pages).set(values).where(eq(pages.id, prev.id));
        if (prev.path !== path && prev.status === "published") await addSlugRedirect(`/${prev.path}/`, `/${path}/`, tx);
        return prev.id;
      }
      const [row] = await tx.insert(pages).values(values).returning({ id: pages.id });
      return row.id;
    });

    const action = !prev ? "page.create" : prev.status !== "published" && st.status === "published" ? "page.publish" : prev.status === "published" && st.status !== "published" ? "page.unpublish" : "page.update";
    await audit({ userId: user.id, action, entityType: "page", entityId: pageId, details: { title: values.title, path, status: st.status } });
    refreshPublic("pages", "posts", `page:${path}`, ...(prev && prev.path !== path ? [`page:${prev.path}`, "redirects"] : []));
    if (!prev) redirect(`/admin/pages/${pageId}/?created=1`);
    return ok(st.status === "published" ? "Saved and live on the website." : "Saved.");
  });
}

export async function deletePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("pages.manage", async (user) => {
    const id = uuidOrNull(fd.get("id"));
    const db = await getDb();
    const [row] = id ? await db.select().from(pages).where(eq(pages.id, id)) : [];
    if (!row) return fail("This page no longer exists.");
    if (row.path === "" || row.template === "index" || row.template === "home") return fail("This page is part of the site structure and can't be deleted. Unpublish its content instead.");
    await saveRevision("page", row.id, { ...row, deleted: true } as unknown as Record<string, unknown>, user.id);
    await db.delete(pages).where(eq(pages.id, row.id));
    await audit({ userId: user.id, action: "page.delete", entityType: "page", entityId: row.id, details: { title: row.title, path: row.path } });
    refreshPublic("pages", "posts", `page:${row.path}`);
    redirect("/admin/pages/?deleted=1");
  });
}
