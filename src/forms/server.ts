import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { submissionFiles, submissions } from "@/db/schema";
import { appUrl, staffRecipients, uploadMaxBytes } from "@/lib/env";
import { enqueueEmails, processOutbox, type QueuedEmail } from "@/lib/email/outbox";
import { logger } from "@/lib/security/logger";
import { rateLimit } from "@/lib/security/rate-limit";
import type { RequestContext } from "@/lib/security/request";
import { createUploadTarget, objectInfo, readHead } from "@/lib/storage";
import { getFormDefinition } from "./registry";
import { fieldsOf, type FieldDef, type FormDefinition } from "./types";
import { contactOf, validateForm, type FieldErrors, type FormValues } from "./validate";

export type SubmitPayload = {
  formId: string;
  values: Record<string, unknown>;
  /** Honeypot: real users never see or fill this. */
  website?: string;
  /** Milliseconds between the form appearing and submit. */
  elapsedMs?: number;
  /** Random per form session; resubmits return the same result. */
  idempotencyKey: string;
  pagePath?: string;
  utm?: Record<string, string>;
  /** The consent statement the visitor ticked (required for the newsletter). */
  consent?: { text: string };
};

export type SubmitResult =
  | { status: "success"; reference: string; message: string }
  | { status: "invalid"; errors: FieldErrors; message: string }
  | { status: "error"; message: string };

const MIN_FILL_MS = 2500;

function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return `LP-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

// ---------------------------------------------------------------- uploads

const SIGNATURES: Record<string, number[][]> = {
  ".pdf": [[0x25, 0x50, 0x44, 0x46]],
  ".png": [[0x89, 0x50, 0x4e, 0x47]],
  ".jpg": [[0xff, 0xd8, 0xff]],
  ".jpeg": [[0xff, 0xd8, 0xff]],
  ".doc": [[0xd0, 0xcf, 0x11, 0xe0]],
  ".docx": [[0x50, 0x4b, 0x03, 0x04]],
  ".xlsx": [[0x50, 0x4b, 0x03, 0x04]],
  ".gif": [[0x47, 0x49, 0x46, 0x38]],
  ".webp": [[0x52, 0x49, 0x46, 0x46]],
};

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const extOf = (name: string) => (name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "");

export function safeFilename(name: string): string {
  const ext = extOf(name);
  const base = name.slice(0, name.length - ext.length).normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "file";
  return `${base}${ext}`;
}

export async function signUpload(input: { formId: string; fieldId: string; filename: string; size: number }, ctx: RequestContext) {
  const def = getFormDefinition(input.formId);
  const field = def && fieldsOf(def).find((f) => f.id === input.fieldId && f.type === "file");
  if (!def || !field) return { ok: false as const, error: "This upload is not allowed." };
  const ext = extOf(input.filename);
  const accept = field.accept ?? [];
  if (!accept.includes(ext) || !MIME[ext]) return { ok: false as const, error: `Allowed file types: ${accept.join(", ")}` };
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > uploadMaxBytes()) {
    return { ok: false as const, error: `Files must be smaller than ${Math.round(uploadMaxBytes() / 1024 / 1024)} MB.` };
  }
  const limited = await rateLimit("formUploadByIp", ctx.ipHash ?? "unknown");
  if (!limited.success) return { ok: false as const, error: "Too many uploads. Please wait and try again." };

  const now = new Date();
  const id = randomUUID();
  const key = `forms/${def.id}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}/${safeFilename(input.filename)}`;
  const db = await getDb();
  await db.insert(submissionFiles).values({ id, fieldId: field.id, key, filename: input.filename.slice(0, 200), mimeType: MIME[ext], size: input.size });
  const target = await createUploadTarget(key, MIME[ext]);
  return { ok: true as const, uploadId: id, ...target };
}

/** Confirms uploaded files exist, match their declared type and belong to this form, then attaches them. */
async function claimFiles(def: FormDefinition, values: FormValues): Promise<{ ok: true; ids: string[] } | { ok: false; errors: FieldErrors }> {
  const fileFields = fieldsOf(def).filter((f) => f.type === "file");
  const wanted = fileFields.flatMap((f) => ((values[f.id] as string[] | undefined) ?? []).map((id) => ({ field: f, id })));
  if (!wanted.length) return { ok: true, ids: [] };
  const db = await getDb();
  const rows = await db
    .select()
    .from(submissionFiles)
    .where(and(inArray(submissionFiles.id, wanted.map((w) => w.id)), isNull(submissionFiles.claimedAt), gt(submissionFiles.createdAt, new Date(Date.now() - 24 * 3600_000))));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const errors: FieldErrors = {};
  for (const { field, id } of wanted) {
    const row = byId.get(id);
    if (!row || row.fieldId !== field.id || !row.key.startsWith(`forms/${def.id}/`)) {
      errors[field.id] = "One of the files could not be found. Please upload it again.";
      continue;
    }
    const info = await objectInfo("uploads", row.key);
    if (!info || info.size === 0 || info.size > uploadMaxBytes()) {
      errors[field.id] = "One of the files did not finish uploading. Please upload it again.";
      continue;
    }
    const sigs = SIGNATURES[extOf(row.key)];
    if (sigs) {
      const head = await readHead("uploads", row.key, 8);
      if (!sigs.some((sig) => sig.every((b, i) => head[i] === b))) errors[field.id] = `“${row.filename}” doesn't look like a valid ${extOf(row.key).slice(1).toUpperCase()} file.`;
    }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, ids: wanted.map((w) => w.id) };
}

// ---------------------------------------------------------------- submit

function displayValue(field: FieldDef, value: string | string[] | undefined, files: Map<string, string>): string {
  if (value === undefined || (Array.isArray(value) && !value.length) || value === "") return "";
  if (field.type === "file") return (value as string[]).map((id) => files.get(id) ?? "file").join(", ");
  if (field.type === "consent") return value === "yes" ? "Yes" : "No";
  return Array.isArray(value) ? value.join(", ") : value;
}

export async function submitForm(payload: SubmitPayload, ctx: RequestContext): Promise<SubmitResult> {
  const def = getFormDefinition(String(payload.formId ?? ""));
  if (!def) return { status: "error", message: "This form is no longer available. Please refresh the page." };
  const idem = typeof payload.idempotencyKey === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(payload.idempotencyKey) ? payload.idempotencyKey : null;
  if (!idem) return { status: "error", message: "Please refresh the page and try again." };

  const db = await getDb();
  // A retried submit (double click, flaky network) returns the original result.
  const [existing] = await db.select({ reference: submissions.reference }).from(submissions).where(eq(submissions.idempotencyKey, idem));
  if (existing) return { status: "success", reference: existing.reference, message: def.successMessage };

  const limited = await rateLimit("formSubmitByIp", ctx.ipHash ?? "unknown");
  if (!limited.success) return { status: "error", message: `Too many submissions from your connection. Please try again in ${Math.ceil(limited.retryAfterSeconds / 60)} minute(s), or call us.` };

  const validated = validateForm(def, payload.values);
  if (!validated.ok) return { status: "invalid", errors: validated.errors, message: "Please correct the highlighted fields." };
  const values = validated.values;
  const consentText = typeof payload.consent?.text === "string" ? payload.consent.text.slice(0, 400) : "";
  if (def.kind === "newsletter" && !consentText) return { status: "invalid", errors: { email: "Please agree to receive emails from us." }, message: "Please agree to receive emails from us." };

  // Likely bots are stored as spam (never emailed) rather than rejected, so a
  // false positive is still recoverable from the admin.
  const spam = Boolean(payload.website) || (typeof payload.elapsedMs === "number" && payload.elapsedMs < MIN_FILL_MS);

  const claimed = await claimFiles(def, values);
  if (!claimed.ok) return { status: "invalid", errors: claimed.errors, message: "Please check your uploaded files." };

  const contact = contactOf(def, values);
  const fileRows = claimed.ids.length ? await db.select({ id: submissionFiles.id, filename: submissionFiles.filename }).from(submissionFiles).where(inArray(submissionFiles.id, claimed.ids)) : [];
  const fileNames = new Map(fileRows.map((f) => [f.id, f.filename]));
  const utm = Object.fromEntries(Object.entries(payload.utm ?? {}).filter(([k, v]) => /^utm_[a-z]+$/.test(k) && typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 100)]));

  let reference = newReference();
  let submissionId: string | null = null;
  let outboxIds: string[] = [];
  for (let attempt = 0; attempt < 3 && !submissionId; attempt++) {
    try {
      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(submissions)
          .values({
            reference,
            formId: def.id,
            formTitle: def.title,
            status: spam ? "spam" : "new",
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            data: values,
            consent: consentText ? { privacy: true, marketing: def.kind === "newsletter", text: consentText, at: new Date().toISOString() } : null,
            meta: { ipHash: ctx.ipHash, userAgent: ctx.userAgent, pagePath: payload.pagePath?.slice(0, 300) ?? ctx.refererPath, utm },
            idempotencyKey: idem,
          })
          .onConflictDoNothing({ target: submissions.idempotencyKey })
          .returning({ id: submissions.id });
        if (!row) return null;
        if (claimed.ids.length) await tx.update(submissionFiles).set({ submissionId: row.id, claimedAt: new Date() }).where(inArray(submissionFiles.id, claimed.ids));
        if (spam || def.kind === "newsletter") return { id: row.id, outbox: [] as string[] };

        const rows = fieldsOf(def)
          .map((f) => ({ label: f.label, value: displayValue(f, values[f.id], fileNames) }))
          .filter((r) => r.value);
        const emails: QueuedEmail[] = [
          {
            idempotencyKey: `submission:${row.id}:staff`,
            template: "submission.staff",
            to: staffRecipients(),
            replyTo: contact.email || null,
            subject: `New ${def.title} request — ${contact.name || contact.email || reference} (${reference})`,
            payload: { formTitle: def.title, reference, rows, files: [...fileNames.values()], adminUrl: `${appUrl()}/admin/submissions/${row.id}/` },
            submissionId: row.id,
          },
        ];
        if (contact.email) {
          emails.push({
            idempotencyKey: `submission:${row.id}:client`,
            template: "submission.client",
            to: [contact.email],
            replyTo: process.env.EMAIL_REPLY_TO || "info@lexpraxisng.com",
            subject: `We received your ${def.title} request (${reference})`,
            payload: { name: contact.name, formTitle: def.title, reference, nextSteps: def.successMessage },
            submissionId: row.id,
          });
        }
        return { id: row.id, outbox: await enqueueEmails(emails, tx) };
      });
      if (!result) {
        const [dupe] = await db.select({ reference: submissions.reference }).from(submissions).where(eq(submissions.idempotencyKey, idem));
        if (dupe) return { status: "success", reference: dupe.reference, message: def.successMessage };
      } else {
        submissionId = result.id;
        outboxIds = result.outbox;
      }
    } catch (err) {
      // Unique reference collision: try another reference.
      if (String((err as Error)?.message ?? "").includes("submissions_reference_idx") || String((err as { cause?: Error })?.cause?.message ?? "").includes("submissions_reference_idx")) {
        reference = newReference();
        continue;
      }
      logger.error("Form submission failed", { formId: def.id, err });
      return { status: "error", message: "We couldn't save your submission. Please try again, or email info@lexpraxisng.com." };
    }
  }
  if (!submissionId) return { status: "error", message: "We couldn't save your submission. Please try again." };

  // Send after responding; the cron job retries anything that fails.
  if (outboxIds.length) after(() => processOutbox({ ids: outboxIds }).catch((err) => logger.error("Outbox send failed", { err })));
  return { status: "success", reference, message: def.successMessage };
}
