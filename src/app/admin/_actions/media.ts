"use server";

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { media } from "@/db/schema";
import { adminAction, invalid } from "@/lib/admin/action";
import { refreshPublic } from "@/lib/admin/content";
import { extOf, inspectStoredMedia, MEDIA_MAX_BYTES, MEDIA_TYPES, mediaReferences } from "@/lib/admin/media";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { can } from "@/lib/auth/permissions";
import { copyObject, deleteObject, objectInfo, readHead } from "@/lib/storage";

// Step 2 of an upload: the file is already in storage. Verify it really is
// what its extension says, read image dimensions, and record it.
export async function finalizeMediaUpload(input: { key: string; filename: string }): Promise<ActionState> {
  return adminAction("media.upload", async (user) => {
    const key = String(input.key ?? "");
    if (!/^wp-content\/uploads\/\d{4}\/\d{2}\/[\w.\- ]+$/.test(key)) return fail("Invalid upload.");
    const ext = extOf(key);
    const type = MEDIA_TYPES[ext];
    if (!type) return fail("File type not allowed.");
    const db = await getDb();
    const [exists] = await db.select({ id: media.id }).from(media).where(eq(media.key, key));
    if (exists) return fail("This file was already added.");
    const info = await objectInfo("media", key);
    if (!info || info.size === 0) return fail("The upload did not finish. Please try again.");
    if (info.size > MEDIA_MAX_BYTES) {
      await deleteObject("media", key);
      return fail("Files must be smaller than 15 MB.");
    }
    const check = await inspectStoredMedia(key, ext);
    if (!check.validSignature) {
      await deleteObject("media", key);
      return fail(`“${input.filename}” is not a valid ${ext.slice(1).toUpperCase()} file.`);
    }
    const head = await readHead("media", key, 64 * 1024);
    const [row] = await db
      .insert(media)
      .values({
        key,
        filename: key.split("/").pop()!,
        mimeType: type.mime,
        size: info.size,
        width: check.size?.width ?? null,
        height: check.size?.height ?? null,
        sha256: createHash("sha256").update(head).digest("hex"),
        uploadedById: user.id,
      })
      .returning({ id: media.id });
    await audit({ userId: user.id, action: "media.upload", entityType: "media", entityId: row.id, details: { key } });
    refreshPublic("media");
    return ok("Uploaded.", { id: row.id, key });
  });
}

/** Replace a file's contents in place (same key and type), after verifying the staged upload. */
export async function finalizeMediaReplace(input: { mediaId: string; uploadKey: string }): Promise<ActionState> {
  return adminAction("media.manage", async (user) => {
    const uploadKey = String(input.uploadKey ?? "");
    if (!/^staging\/[0-9a-f-]{36}\/[\w.\- ]+$/.test(uploadKey)) return fail("Invalid upload.");
    const db = await getDb();
    const [row] = await db.select().from(media).where(eq(media.id, String(input.mediaId)));
    if (!row) return fail("File not found.");
    const ext = extOf(row.key);
    if (extOf(uploadKey) !== ext && MEDIA_TYPES[extOf(uploadKey)]?.mime !== row.mimeType) {
      await deleteObject("media", uploadKey);
      return fail(`The replacement must be a ${ext} file.`);
    }
    const info = await objectInfo("media", uploadKey);
    if (!info || info.size === 0 || info.size > MEDIA_MAX_BYTES) {
      await deleteObject("media", uploadKey);
      return fail("The upload did not finish or is too large.");
    }
    const check = await inspectStoredMedia(uploadKey, extOf(uploadKey));
    if (!check.validSignature) {
      await deleteObject("media", uploadKey);
      return fail("That file doesn't match its type.");
    }
    await copyObject("media", uploadKey, row.key, row.mimeType);
    await deleteObject("media", uploadKey);
    await db
      .update(media)
      .set({ size: info.size, width: check.size?.width ?? row.width, height: check.size?.height ?? row.height, uploadedById: user.id })
      .where(eq(media.id, row.id));
    await audit({ userId: user.id, action: "media.replace", entityType: "media", entityId: row.id, details: { key: row.key } });
    refreshPublic("media", "posts", "pages", "services", "documents");
    return ok("File replaced. Browsers and the CDN may show the old version for a short while.");
  });
}

const metaSchema = z.object({
  id: z.uuid(),
  alt: z.string().trim().max(300),
  caption: z.string().trim().max(1000),
  description: z.string().trim().max(2000),
});

export async function updateMedia(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("media.upload", async (user) => {
    const parsed = metaSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const [row] = await db.select({ uploadedById: media.uploadedById }).from(media).where(eq(media.id, parsed.data.id));
    if (!row) return fail("File not found.");
    // Authors may edit details of their own uploads; editors and administrators any file.
    if (!can(user.role, "media.manage") && row.uploadedById !== user.id) return fail("You can only edit files you uploaded.");
    const { id, ...values } = parsed.data;
    await db.update(media).set(values).where(eq(media.id, id));
    await audit({ userId: user.id, action: "media.update", entityType: "media", entityId: id });
    refreshPublic("media");
    return ok("Saved.");
  });
}

export async function deleteMedia(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("media.manage", async (user) => {
    const id = String(fd.get("id") ?? "");
    const force = fd.get("force") === "yes";
    const db = await getDb();
    const [row] = await db.select().from(media).where(eq(media.id, id));
    if (!row) return fail("File not found.");
    const refs = await mediaReferences(row);
    if (refs.length && !force) {
      return fail(`This file is used in ${refs.length} place(s): ${refs.slice(0, 5).map((r) => `${r.type} “${r.title}”`).join(", ")}${refs.length > 5 ? "…" : ""}. Tick “Delete anyway” to remove it; those places will show a missing image.`);
    }
    await db.delete(media).where(eq(media.id, id));
    try {
      await deleteObject("media", row.key);
    } catch {
      // The record is gone; a leftover object is harmless and can be cleaned up later.
    }
    await audit({ userId: user.id, action: "media.delete", entityType: "media", entityId: id, details: { key: row.key, references: refs.length } });
    refreshPublic("media", "posts", "pages", "services", "documents", "authors");
    redirect("/admin/media/?deleted=1");
  });
}
