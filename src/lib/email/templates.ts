// Branded HTML emails with plain-text alternatives, rendered at send time from
// the payload stored in the outbox. Built for email clients: table layout,
// inline styles, a fixed-width wrapper for Outlook, a hidden preview line, and
// buttons that work without CSS support.
import { siteUrl } from "@/lib/env";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NAVY = "#20336d";
const NAVY_DARK = "#112347";
const GOLD = "#ae844e";
const INK = "#1f2937";
const MUTED = "#4b5563";
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Helvetica,Arial,sans-serif";

const FIRM = DEFAULT_SETTINGS.site;
const SOCIAL: [label: string, url: string][] = [
  ["LinkedIn", FIRM.social.linkedin],
  ["Instagram", FIRM.social.instagram],
  ["Facebook", FIRM.social.facebook],
  ["YouTube", FIRM.social.youtube],
].filter((s): s is [string, string] => Boolean(s[1]));

type Audience = "client" | "staff";

const NOTICES: Record<Audience, string> = {
  client: `This email is confidential and intended only for the person it is addressed to. If you received it by mistake, please let us know at ${FIRM.email} and delete it. You are receiving it because you contacted us through lexpraxisng.com.`,
  staff: "Confidential client information. Do not forward outside the firm.",
};

type LayoutOptions = {
  /** <title> and the heading shown at the top of the card. */
  title: string;
  /** Inbox preview line (hidden in the email itself). */
  preheader: string;
  body: string;
  audience?: Audience;
};

function footerHtml(audience: Audience): string {
  const site = siteUrl();
  const offices = FIRM.offices.map((o) => `<strong style="color:#ffffff">${escapeHtml(o.city)}:</strong> ${escapeHtml(o.address)}`).join("<br>");
  const social = SOCIAL.map(([label, url]) => `<a href="${escapeHtml(url)}" style="color:${GOLD};text-decoration:none">${label}</a>`).join(" &nbsp;·&nbsp; ");
  return `<tr><td style="background:${NAVY_DARK};padding:26px 32px;font-family:${SANS};font-size:13px;line-height:1.7;color:#cbd3e6">
<p style="margin:0 0 4px;font-family:${SERIF};font-size:17px;color:#ffffff">${escapeHtml(FIRM.name)}</p>
<p style="margin:0 0 14px;font-style:italic;color:#aeb8d0">${escapeHtml(FIRM.footerNote)}</p>
<p style="margin:0 0 12px">${offices}</p>
<p style="margin:0 0 12px">${FIRM.phones.map((p) => `<a href="tel:${p.replace(/\s+/g, "")}" style="color:#ffffff;text-decoration:none">${escapeHtml(p)}</a>`).join(" &nbsp;·&nbsp; ")}<br>
<a href="mailto:${FIRM.email}" style="color:#ffffff;text-decoration:none">${FIRM.email}</a> &nbsp;·&nbsp; <a href="${site}/" style="color:#ffffff;text-decoration:none">${site.replace(/^https?:\/\//, "")}</a></p>
${audience === "client" && social ? `<p style="margin:0">${social}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 32px 0;font-family:${SANS};font-size:11px;line-height:1.6;color:#6b7280">${escapeHtml(NOTICES[audience])}</td></tr>`;
}

export function layout({ title, preheader, body, audience = "client" }: LayoutOptions): string {
  const site = siteUrl();
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
<!--[if mso]><style>table,td{font-family:Arial,sans-serif !important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f4f1ea;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f1ea;font-size:1px;line-height:1px">${escapeHtml(preheader)}${"&#8199;&#847; ".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1ea">
<tr><td align="center" style="padding:28px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:24px 32px 20px;border-bottom:3px solid ${GOLD}">
<a href="${site}/"><img src="${site}/theme/lexpraxis-logo.png" width="170" height="56" alt="${escapeHtml(FIRM.name)}" style="display:block;border:0;width:170px;height:auto"></a>
</td></tr>
<tr><td style="padding:30px 32px 32px;font-family:${SANS};font-size:15px;line-height:1.65;color:${INK}">
<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:24px;line-height:1.3;font-weight:normal;color:${NAVY}">${escapeHtml(title)}</h1>
${body}
</td></tr>
${footerHtml(audience)}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

/** A button that renders in Outlook too (padding sits on the cell, not the link). */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0"><tr><td bgcolor="${NAVY}" style="border-radius:8px;background:${NAVY}">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/** For links in buttons: the address in plain text, in case the button doesn't work. */
function fallbackLink(href: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;color:${MUTED}">If the button doesn't work, copy this address into your browser:<br><a href="${escapeHtml(href)}" style="color:${NAVY};word-break:break-all">${escapeHtml(href)}</a></p>`;
}

function panel(rows: [label: string, value: string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:#f7f3ec;border-left:4px solid ${GOLD};border-radius:6px">
<tr><td style="padding:14px 18px;font-size:14px;line-height:1.7">${rows.map(([l, v]) => `<span style="color:${MUTED}">${escapeHtml(l)}:</span> <strong style="color:${INK}">${escapeHtml(v)}</strong>`).join("<br>")}</td></tr></table>`;
}

type Row = { label: string; value: string };

function rowsHtml(rows: Row[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 16px">${rows
    .map(
      (r) =>
        `<tr><td style="padding:9px 10px 9px 0;border-bottom:1px solid #ece8df;color:${MUTED};width:38%;vertical-align:top;font-size:13px">${escapeHtml(r.label)}</td><td style="padding:9px 0 9px 10px;border-bottom:1px solid #ece8df;vertical-align:top;font-size:14px;white-space:pre-wrap">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("")}</table>`;
}

const textFooter = (audience: Audience) =>
  `\n\n--\n${FIRM.name}\n${FIRM.offices.map((o) => `${o.city}: ${o.address}`).join("\n")}\n${FIRM.phones.join(" · ")}\n${FIRM.email} · ${siteUrl().replace(/^https?:\/\//, "")}\n\n${NOTICES[audience]}`;

/** Form success messages begin with their own "Thank you…" sentence; the email already thanks the client once. */
function withoutLeadingThanks(text: string): string {
  return text.replace(/^\s*thank you[^.!]*[.!]\s*/i, "").trim();
}

export type TemplateName = "submission.staff" | "submission.client" | "auth.invite" | "auth.reset";

export type Rendered = { html: string; text: string };

export function renderTemplate(name: TemplateName, p: Record<string, unknown>): Rendered {
  switch (name) {
    case "submission.staff": {
      const rows = (p.rows as Row[]) ?? [];
      const files = (p.files as string[]) ?? [];
      const who = rows.find((r) => /name/i.test(r.label))?.value || rows.find((r) => /email/i.test(r.label))?.value || "";
      const title = `New ${String(p.formTitle)} enquiry`;
      const body = `${panel([
        ["Reference", String(p.reference)],
        ...(who ? ([["From", who]] as [string, string][]) : []),
      ])}
${rowsHtml(rows.slice(0, 60))}${rows.length > 60 ? `<p style="margin:0 0 12px">…and ${rows.length - 60} more answers in the admin.</p>` : ""}
${files.length ? `<p style="margin:0 0 12px">${files.length} file${files.length === 1 ? "" : "s"} attached in the admin (not sent by email, for confidentiality).</p>` : ""}
<p style="margin:0">Reply to this email to answer the client directly.</p>
${button(String(p.adminUrl), "Open in admin")}`;
      const text = `${title} (${p.reference})\n\n${rows
        .slice(0, 60)
        .map((r) => `${r.label}: ${r.value}`)
        .join("\n")}\n\n${files.length ? `${files.length} file(s) in the admin.\n` : ""}Open in admin: ${p.adminUrl}${textFooter("staff")}`;
      return { html: layout({ title, preheader: `${who ? `${who} · ` : ""}reference ${p.reference}`, body, audience: "staff" }), text };
    }
    case "submission.client": {
      const name = String(p.name || "").trim();
      const next = withoutLeadingThanks(String(p.nextSteps || "")) || "A member of our team will review your information and get back to you within one business day.";
      const body = `<p style="margin:0 0 14px">Dear ${escapeHtml(name || "Sir/Madam")},</p>
<p style="margin:0 0 14px">Thank you for contacting ${escapeHtml(FIRM.name)}. Your request has reached our team.</p>
${panel([
  ["Your reference", String(p.reference)],
  ["Request", String(p.formTitle)],
])}
<p style="margin:0 0 14px">${escapeHtml(next)}</p>
<p style="margin:0 0 14px">Need to add something? Reply to this email and quote your reference, or call us on <a href="tel:${FIRM.phones[0].replace(/\s+/g, "")}" style="color:${NAVY}">${escapeHtml(FIRM.phones[0])}</a>.</p>
<p style="margin:22px 0 0">Kind regards,<br><strong>The ${escapeHtml(FIRM.name)} team</strong></p>`;
      const text = `Dear ${name || "Sir/Madam"},\n\nThank you for contacting ${FIRM.name}. Your request has reached our team.\n\nYour reference: ${p.reference}\nRequest: ${p.formTitle}\n\n${next}\n\nNeed to add something? Reply to this email and quote your reference, or call us on ${FIRM.phones[0]}.\n\nKind regards,\nThe ${FIRM.name} team${textFooter("client")}`;
      return { html: layout({ title: "We've received your request", preheader: `Your reference is ${p.reference}. Keep it for your records.`, body }), text };
    }
    case "auth.invite": {
      const link = String(p.link);
      const body = `<p style="margin:0 0 14px">Hi ${escapeHtml(p.name)},</p>
<p style="margin:0 0 14px">${escapeHtml(p.inviter)} has invited you to manage the ${escapeHtml(FIRM.name)} website as <strong>${escapeHtml(p.role)}</strong>. Choose a password to get started.</p>
${button(link, "Accept invitation")}
${fallbackLink(link)}
<p style="margin:0;font-size:13px;color:${MUTED}">The link works once and expires in 7 days. After signing in, turn on two-factor authentication under My account.</p>`;
      return {
        html: layout({ title: "You're invited to the website admin", preheader: `${p.inviter} invited you to the ${FIRM.name} website admin.`, body, audience: "staff" }),
        text: `Hi ${p.name},\n\n${p.inviter} has invited you to manage the ${FIRM.name} website as ${p.role}. Choose a password to get started (the link works once and expires in 7 days):\n\n${link}${textFooter("staff")}`,
      };
    }
    case "auth.reset": {
      const link = String(p.link);
      const body = `<p style="margin:0 0 14px">Hi ${escapeHtml(p.name)},</p>
<p style="margin:0 0 14px">We received a request to reset the password for your ${escapeHtml(FIRM.name)} website admin account.</p>
${button(link, "Choose a new password")}
${fallbackLink(link)}
<p style="margin:0;font-size:13px;color:${MUTED}">The link works once and expires in 60 minutes. If you didn't ask for this, you can ignore this email; your password won't change.</p>`;
      return {
        html: layout({ title: "Reset your password", preheader: "Use this link within 60 minutes to choose a new password.", body, audience: "staff" }),
        text: `Hi ${p.name},\n\nWe received a request to reset your ${FIRM.name} website admin password. Choose a new one here (works once, expires in 60 minutes):\n\n${link}\n\nIf you didn't ask for this, ignore this email; your password won't change.${textFooter("staff")}`,
      };
    }
  }
}
