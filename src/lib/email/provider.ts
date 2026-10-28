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

/**
 * SES settings. One AWS access key can serve both S3 and SES, so the SES_*
 * values fall back to the S3_* ones when not set separately.
 */
export function sesSettings() {
  const accessKeyId = process.env.SES_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.SES_REGION || process.env.S3_REGION;
  // S3 keys only imply SES if SES was asked for (SES_REGION set) or no other provider is configured.
  const enabled = Boolean(accessKeyId && secretAccessKey && region && (process.env.SES_REGION || process.env.SES_ACCESS_KEY_ID || !process.env.RESEND_API_KEY));
  return { enabled, accessKeyId: accessKeyId ?? "", secretAccessKey: secretAccessKey ?? "", region: region ?? "" };
}

/** Which transport is configured: Amazon SES, Resend, or none. */
export function emailProvider(): "ses" | "resend" | null {
  if (sesSettings().enabled) return "ses";
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
  const cfg = sesSettings();
  sesClient ??= new SESv2Client({ region: cfg.region, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
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
