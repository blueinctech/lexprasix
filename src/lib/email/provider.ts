import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { Resend } from "resend";
import { ConfigurationError, isDev } from "@/lib/env";

// Transactional email transport: Amazon SES (SES_* variables) or Resend
// (RESEND_API_KEY). In local development without either, messages are written to .data/mail/ so they can be
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
let sesClient: SESv2Client | null = null;

export function emailFrom(): string {
  return process.env.EMAIL_FROM || "LexPraxis Solicitors <no-reply@lexpraxisng.com>";
}

/** Which transport is configured: Amazon SES, Resend, or none. */
export function emailProvider(): "ses" | "resend" | null {
  if (process.env.SES_REGION && process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY) return "ses";
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

export async function sendViaProvider(email: OutgoingEmail): Promise<SendResult> {
  const provider = emailProvider();
  if (provider === "ses") return sendViaSes(email);
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (isDev) return writeDevMail(email);
    throw new ConfigurationError("SES_ACCESS_KEY_ID", "Email sending");
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

// Amazon SES. SES has no idempotency key; the outbox's conditional claim
// (one row sent by one worker) is what prevents duplicates.
async function sendViaSes(email: OutgoingEmail): Promise<SendResult> {
  sesClient ??= new SESv2Client({
    region: process.env.SES_REGION!,
    credentials: { accessKeyId: process.env.SES_ACCESS_KEY_ID!, secretAccessKey: process.env.SES_SECRET_ACCESS_KEY! },
  });
  try {
    const res = await sesClient.send(
      new SendEmailCommand({
        FromEmailAddress: emailFrom(),
        Destination: { ToAddresses: email.to },
        ReplyToAddresses: email.replyTo ? [email.replyTo] : undefined,
        ...(process.env.SES_CONFIGURATION_SET ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET } : {}),
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: "UTF-8" },
            Body: { Text: { Data: email.text, Charset: "UTF-8" }, Html: { Data: email.html, Charset: "UTF-8" } },
          },
        },
      }),
    );
    return { ok: true, messageId: res.MessageId ?? "ses" };
  } catch (err) {
    const e = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    const status = e.$metadata?.httpStatusCode ?? 0;
    // Throttling and server errors are worth retrying; rejected/unverified addresses are not.
    const retryable = status === 0 || status === 429 || status >= 500 || /Throttl|TooManyRequests/i.test(e.name ?? "");
    return { ok: false, error: `${e.name ?? "SES error"}: ${(e.message ?? "").slice(0, 300)}`, retryable };
  }
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
