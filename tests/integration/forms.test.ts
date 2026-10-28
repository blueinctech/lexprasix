import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { SubmitPayload } from "@/forms/server";
import { prepareTestDatabase } from "./setup";

// Real database and form engine; only Next.js request APIs are stubbed.
let db: Awaited<ReturnType<typeof import("@/db").getDb>>;
let s: typeof import("@/db/schema");
let forms: typeof import("@/forms/server");
let storage: typeof import("@/lib/storage");
let registry: typeof import("@/forms/registry");
let nextServer: typeof import("../stubs/next-server");

const ctx = (ip = randomUUID()) => ({ ip, ipHash: ip.slice(0, 32), userAgent: "vitest", refererPath: "/contact-us/" });
const valid = { name: "Ada Test", email: "ada@example.com", phone: "+234 803 000 0000", message: "Integration test" };

beforeAll(async () => {
  await prepareTestDatabase();
  db = await (await import("@/db")).getDb();
  s = await import("@/db/schema");
  forms = await import("@/forms/server");
  storage = await import("@/lib/storage");
  registry = await import("@/forms/registry");
  nextServer = await import("../stubs/next-server");
});

const submit = (values: Record<string, unknown>, extra: Partial<SubmitPayload> = {}, c = ctx()) =>
  forms.submitForm({ formId: "contact", values, idempotencyKey: randomUUID(), elapsedMs: 10_000, ...extra }, c);

describe("public form submission", () => {
  it("stores a valid enquiry and sends staff + client emails through the outbox", async () => {
    const res = await submit(valid);
    expect(res.status).toBe("success");
    if (res.status !== "success") return;
    const [row] = await db.select().from(s.submissions).where(eq(s.submissions.reference, res.reference));
    expect(row).toMatchObject({ formId: "contact", status: "new", name: "Ada Test", email: "ada@example.com" });
    await Promise.all(nextServer.pending.splice(0));
    const mails = await db.select().from(s.emailOutbox).where(eq(s.emailOutbox.submissionId, row.id));
    expect(mails.map((m) => m.template).sort()).toEqual(["submission.client", "submission.staff"]);
    expect(mails.every((m) => m.status === "sent")).toBe(true);
  });

  it("is idempotent: a retried submit returns the same reference and stores one row", async () => {
    const key = randomUUID();
    const a = await submit(valid, { idempotencyKey: key });
    const b = await submit(valid, { idempotencyKey: key });
    expect(a.status).toBe("success");
    expect(b).toEqual(a);
    expect(await db.select().from(s.submissions).where(eq(s.submissions.idempotencyKey, key))).toHaveLength(1);
  });

  it("rejects invalid input with field errors and stores nothing", async () => {
    const key = randomUUID();
    const res = await submit({ ...valid, email: "nope" }, { idempotencyKey: key });
    expect(res.status).toBe("invalid");
    if (res.status === "invalid") expect(res.errors.email).toBeTruthy();
    expect(await db.select().from(s.submissions).where(eq(s.submissions.idempotencyKey, key))).toHaveLength(0);
  });

  it("stores honeypot and too-fast submissions as spam without emailing", async () => {
    for (const extra of [{ website: "http://spam.example" }, { elapsedMs: 300 }]) {
      const res = await submit(valid, extra);
      expect(res.status).toBe("success");
      if (res.status !== "success") continue;
      const [row] = await db.select().from(s.submissions).where(eq(s.submissions.reference, res.reference));
      expect(row.status).toBe("spam");
      expect(await db.select().from(s.emailOutbox).where(eq(s.emailOutbox.submissionId, row.id))).toHaveLength(0);
    }
  });

  it("rate-limits repeated submissions from one connection", async () => {
    const c = ctx();
    const results: string[] = [];
    for (let i = 0; i < 10; i++) results.push((await submit(valid, {}, c)).status);
    expect(results.slice(0, 8).every((r) => r === "success")).toBe(true);
    expect(results.slice(8)).toEqual(["error", "error"]);
  });

  it("requires recorded consent for the newsletter", async () => {
    const base = { formId: "newsletter", values: { email: "n@example.com" }, elapsedMs: 5000 };
    expect((await forms.submitForm({ ...base, idempotencyKey: randomUUID() }, ctx())).status).toBe("invalid");
    const yes = await forms.submitForm({ ...base, idempotencyKey: randomUUID(), consent: { text: "I agree" } }, ctx());
    expect(yes.status).toBe("success");
    if (yes.status === "success") {
      const [row] = await db.select().from(s.submissions).where(eq(s.submissions.reference, yes.reference));
      expect(row.consent?.text).toBe("I agree");
    }
  });
});

describe("document uploads", () => {
  it("only signs uploads for real file fields with allowed types", async () => {
    expect((await forms.signUpload({ formId: "contact", fieldId: "message", filename: "a.pdf", size: 10 }, ctx())).ok).toBe(false);
    const def = registry.getFormDefinition("company-registration")!;
    const field = def.steps.flatMap((st) => st.items).find((i) => i.kind === "field" && i.type === "file")!;
    expect((await forms.signUpload({ formId: def.id, fieldId: field.id, filename: "a.exe", size: 10 }, ctx())).ok).toBe(false);
    expect((await forms.signUpload({ formId: def.id, fieldId: field.id, filename: "a.pdf", size: 50 * 1024 * 1024 }, ctx())).ok).toBe(false);
  });

  it("rejects a file whose content doesn't match its extension and accepts a real PDF", async () => {
    const def = registry.getFormDefinition("company-registration")!;
    const items = def.steps.flatMap((st) => st.items);
    const field = items.find((i) => i.kind === "field" && i.type === "file")!;
    const sign = async (body: Buffer) => {
      const r = await forms.signUpload({ formId: def.id, fieldId: field.id, filename: "cert.pdf", size: body.length }, ctx());
      if (!r.ok) throw new Error(r.error);
      const [row] = await db.select().from(s.submissionFiles).where(eq(s.submissionFiles.id, r.uploadId));
      await storage.putObject("uploads", row.key, body, "application/pdf");
      return r.uploadId;
    };
    const fake = await sign(Buffer.from("MZ this is really an executable"));
    const good = await sign(Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 32)]));
    // Fill every required field so only the file decides the outcome.
    const values: Record<string, unknown> = {};
    for (const f of items) {
      if (f.kind !== "field" || !f.required || f.type === "file") continue;
      values[f.id] =
        f.type === "email" ? "a@example.com" : f.type === "tel" ? "+2348030000000" : f.type === "date" ? "1990-01-01" : f.type === "consent" ? "yes" : f.choices ? (f.type === "checkbox" ? [f.choices[0]] : f.choices[0]) : "Test";
    }
    const bad = await forms.submitForm({ formId: def.id, values: { ...values, [field.id]: [fake] }, idempotencyKey: randomUUID(), elapsedMs: 9000 }, ctx());
    expect(bad.status).toBe("invalid");
    const okRes = await forms.submitForm({ formId: def.id, values: { ...values, [field.id]: [good] }, idempotencyKey: randomUUID(), elapsedMs: 9000 }, ctx());
    expect(okRes.status).toBe("success");
    const [file] = await db.select().from(s.submissionFiles).where(eq(s.submissionFiles.id, good));
    expect(file.claimedAt).toBeTruthy();
    expect(file.submissionId).toBeTruthy();
  });
});
