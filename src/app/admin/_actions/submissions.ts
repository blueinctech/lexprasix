"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { submissionFiles, submissionNotes, submissions, submissionStatus, users } from "@/db/schema";
import { adminAction, invalid } from "@/lib/admin/action";
import { fail, ok, type ActionState } from "@/lib/admin/types";
import { audit } from "@/lib/audit";
import { deleteObject } from "@/lib/storage";

const id = z.uuid();

export async function updateSubmission(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("submissions.manage", async (user) => {
    const parsed = z
      .object({ id, status: z.enum(submissionStatus.enumValues), assignedToId: z.union([z.uuid(), z.literal("")]) })
      .safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    if (parsed.data.assignedToId) {
      const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, parsed.data.assignedToId), eq(users.isActive, true)));
      if (!u) return fail("That staff member is not active.");
    }
    const [before] = await db.select({ status: submissions.status, assignedToId: submissions.assignedToId }).from(submissions).where(eq(submissions.id, parsed.data.id));
    if (!before) return fail("Enquiry not found.");
    await db
      .update(submissions)
      .set({ status: parsed.data.status, assignedToId: parsed.data.assignedToId || null })
      .where(eq(submissions.id, parsed.data.id));
    await audit({ userId: user.id, action: "submission.update", entityType: "submission", entityId: parsed.data.id, details: { from: before.status, to: parsed.data.status, assigned: Boolean(parsed.data.assignedToId) } });
    return ok("Saved.");
  });
}

export async function addNote(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("submissions.manage", async (user) => {
    const parsed = z.object({ id, body: z.string().trim().min(1, { error: "Write a note first" }).max(5000) }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    await db.insert(submissionNotes).values({ submissionId: parsed.data.id, userId: user.id, body: parsed.data.body });
    await audit({ userId: user.id, action: "submission.note", entityType: "submission", entityId: parsed.data.id });
    return ok("Note added.");
  });
}

/** Bulk status change from the list (e.g. mark selected as spam or archived). */
export async function bulkUpdate(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return adminAction("submissions.manage", async (user) => {
    const ids = fd.getAll("ids").map(String).filter((x) => id.safeParse(x).success);
    const status = z.enum(submissionStatus.enumValues).safeParse(fd.get("status"));
    if (!ids.length) return fail("Select at least one enquiry.");
    if (!status.success) return fail("Choose a status.");
    const db = await getDb();
    await db.update(submissions).set({ status: status.data }).where(inArray(submissions.id, ids));
    await audit({ userId: user.id, action: "submission.bulk_update", entityType: "submission", details: { count: ids.length, to: status.data } });
    return ok(`Updated ${ids.length} enquir${ids.length === 1 ? "y" : "ies"}.`);
  });
}

/** Permanently deletes an enquiry and its uploaded files (retention / data-subject requests). */
export async function deleteSubmission(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await adminAction("submissions.delete", async (user) => {
    const parsed = z.object({ id, confirm: z.literal("DELETE", { error: 'Type DELETE to confirm' }) }).safeParse(Object.fromEntries(fd));
    if (!parsed.success) return invalid(parsed.error);
    const db = await getDb();
    const files = await db.select({ key: submissionFiles.key }).from(submissionFiles).where(eq(submissionFiles.submissionId, parsed.data.id));
    for (const f of files) await deleteObject("uploads", f.key);
    const [row] = await db.delete(submissions).where(eq(submissions.id, parsed.data.id)).returning({ reference: submissions.reference });
    if (!row) return fail("Enquiry not found.");
    await audit({ userId: user.id, action: "submission.delete", entityType: "submission", entityId: parsed.data.id, details: { reference: row.reference, files: files.length } });
    return ok("deleted");
  });
  if (result.status === "ok") redirect("/admin/submissions/?deleted=1");
  return result;
}
