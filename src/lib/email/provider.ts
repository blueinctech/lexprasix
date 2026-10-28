import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { ConfigurationError, isDev } from "@/lib/env";

// Transactional email transport. Resend in production; in local development
// without RESEND_API_KEY, messages are written to .data/mail/ so they can be
// opened and checked. Production without a key fails loudly (the outbox marks
// the email "failed" and shows the reason in the admin) — it never pretends to send.

export type OutgoingEmail = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /** Passed to the provider so a retried request is not sent twice. */
  idempotencyKey: string;
};

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string; retryable: boolean };

let client: Resend | null = null;

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "LexPraxis Solicitors <no-reply@lexpraxisng.com>";
}

export async function sendViaProvider(email: OutgoingEmail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isDev) return writeDevMail(email);
    throw new ConfigurationError("RESEND_API_KEY", "Email sending");
  }
  client ??= new Resend(key);
  const { data, error } = await client.emails.send(
    {
      from: emailFrom(),
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    },
    { idempotencyKey: email.idempotencyKey.slice(0, 256) },
  );
  if (error || !data) {
    const status = (error as { statusCode?: number } | null)?.statusCode ?? 0;
    // 4xx (bad address, unverified domain) will not succeed on retry, except rate limits.
    const retryable = status === 0 || status === 429 || status >= 500;
    return { ok: false, error: error?.message ?? "Unknown provider error", retryable };
  }
  return { ok: true, messageId: data.id };
}

async function writeDevMail(email: OutgoingEmail): Promise<SendResult> {
  const dir = path.join(process.cwd(), ".data", "mail");
  await mkdir(dir, { recursive: true });
  const id = `dev-${Date.now()}-${email.idempotencyKey.replace(/[^a-z0-9]+/gi, "-").slice(0, 60)}`;
  await writeFile(
    path.join(dir, `${id}.html`),
    `<!-- To: ${email.to.join(", ")}\n     Subject: ${email.subject}\n     Reply-To: ${email.replyTo ?? ""} -->\n${email.html}`,
  );
  return { ok: true, messageId: id };
}
