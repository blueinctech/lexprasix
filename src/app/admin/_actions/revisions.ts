"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { documents, pages, posts, services } from "@/db/schema";
import { adminAction } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { uuidOrNull } from "@/lib/admin/editing";
import { getRevision, saveRevision } from "@/lib/admin/revisions";
import { fail, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";

// Restores the content of an earlier version. URL (slug/path) and publication
// status are left as they are, so restoring never moves or unpublishes a page.

const CONTENT_FIELDS = {
  post: ["title", "excerpt", "html", "featuredImageId", "seo", "readingMinutes"],
  page: ["title", "summary", "blocks", "featuredImageId", "seo"],
  service: ["title", "shortTitle", "summary", "body", "audience", "process", "faqs", "ctaLabel", "ctaHref", "icon", "featuredImageId", "seo"],
  document: ["title", "summary", "body", "deliverables", "requirements", "faqs", "formId", "featuredImageId", "seo"],
} as const;

const TABLES = { post: posts, page: pages, service: services, document: documents } as const;
const EDIT_URL = { post: "posts", page: "pages", service: "services", document: "documents" } as const;
const TAG = { post: "posts", page: "pages", service: "services", document: "documents" } as const;

export async function restoreRevision(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("posts.edit_own", async (user) => {
    const rev = await getRevision(uuidOrNull(fd.get("revisionId")) ?? "00000000-0000-0000-0000-000000000000");
    if (!rev) return fail("That version no longer exists.");
    const type = rev.entityType;
    const allowed = type === "post" ? can(user.role, "posts.edit_any") : can(user.role, `${type}s.manage` as "pages.manage");
    if (!allowed) return fail("You don't have permission to restore this version.");
    const table = TABLES[type];
    const db = await getDb();
    const [current] = await db.select().from(table as typeof posts).where(eq((table as typeof posts).id, rev.entityId));
    if (!current) return fail("The record has been deleted.");
    const snap = rev.snapshot as Record<string, unknown>;
    const patch = Object.fromEntries(CONTENT_FIELDS[type].filter((k) => k in snap).map((k) => [k, snap[k]]));
    await saveRevision(type, rev.entityId, current as unknown as Record<string, unknown>, user.id);
    await db
      .update(table as typeof posts)
      .set({ ...(patch as object), updatedById: user.id })
      .where(eq((table as typeof posts).id, rev.entityId));
    await audit({ userId: user.id, action: `${type}.restore_revision`, entityType: type, entityId: rev.entityId, details: { revisionId: rev.id } });
    const slugTag = type === "page" ? `page:${(current as unknown as { path: string }).path}` : `${type}:${(current as unknown as { slug: string }).slug}`;
    refreshPublic(TAG[type], slugTag);
    redirect(`/admin/${EDIT_URL[type]}/${rev.entityId}/?restored=1`);
  });
}
