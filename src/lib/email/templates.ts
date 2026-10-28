// Branded HTML emails with plain-text alternatives. Rendered at send time from
// the payload stored in the outbox. Table layout + inline styles for email clients.

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const NAVY = "#112347";
const GOLD = "#ae844e";

export function layout(title: string, body: string, footer = "LexPraxis Solicitors · Lagos · Abuja · Calabar"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f1e9;font-family:Helvetica,Arial,sans-serif;color:#141a26">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${NAVY};padding:22px 28px;color:#ffffff;font-family:Georgia,serif;font-size:20px;letter-spacing:.3px">LexPraxis <span style="color:${GOLD}">Solicitors</span></td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e3e0d8;color:#4a5366;font-size:12px">${escapeHtml(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${NAVY};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

type Row = { label: string; value: string };

function rowsHtml(rows: Row[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0">${rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee;color:#4a5366;width:38%;vertical-align:top;font-size:13px">${escapeHtml(r.label)}</td><td style="padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top;white-space:pre-wrap">${escapeHtml(r.value)}</td></tr>`,
    )
    .join("")}</table>`;
}

export type TemplateName = "submission.staff" | "submission.client" | "auth.invite" | "auth.reset";

export type Rendered = { html: string; text: string };

export function renderTemplate(name: TemplateName, p: Record<string, unknown>): Rendered {
  switch (name) {
    case "submission.staff": {
      const rows = (p.rows as Row[]) ?? [];
      const files = (p.files as string[]) ?? [];
      const body = `<p style="margin-top:0"><strong>New ${escapeHtml(p.formTitle)}</strong> enquiry, reference <strong>${escapeHtml(p.reference)}</strong>.</p>
${rowsHtml(rows.slice(0, 60))}${rows.length > 60 ? `<p>…and ${rows.length - 60} more answers in the admin.</p>` : ""}
${files.length ? `<p>${files.length} file(s) attached in the admin (not sent by email for confidentiality).</p>` : ""}
${button(String(p.adminUrl), "Open in admin")}`;
      const text = `New ${p.formTitle} enquiry (${p.reference})\n\n${rows
        .slice(0, 60)
        .map((r) => `${r.label}: ${r.value}`)
        .join("\n")}\n\n${files.length ? `${files.length} file(s) in the admin.\n` : ""}Open: ${p.adminUrl}`;
      return { html: layout(`New enquiry ${p.reference}`, body, "Confidential client information. Do not forward outside the firm."), text };
    }
    case "submission.client": {
      const body = `<p style="margin-top:0">Dear ${escapeHtml(p.name || "client")},</p>
<p>Thank you for contacting LexPraxis Solicitors. We have received your <strong>${escapeHtml(p.formTitle)}</strong> request (reference <strong>${escapeHtml(p.reference)}</strong>).</p>
<p>${escapeHtml(p.nextSteps || "A member of our team will review your information and get back to you within one business day.")}</p>
<p>If you need to add anything, simply reply to this email and quote your reference.</p>
<p>Kind regards,<br>LexPraxis Solicitors</p>`;
      const text = `Dear ${p.name || "client"},\n\nThank you for contacting LexPraxis Solicitors. We have received your ${p.formTitle} request (reference ${p.reference}).\n\n${
        p.nextSteps || "A member of our team will review your information and get back to you within one business day."
      }\n\nIf you need to add anything, reply to this email and quote your reference.\n\nKind regards,\nLexPraxis Solicitors`;
      return { html: layout(`We received your request (${p.reference})`, body), text };
    }
    case "auth.invite": {
      const body = `<p style="margin-top:0">Hi ${escapeHtml(p.name)},</p><p>${escapeHtml(p.inviter)} invited you to manage the LexPraxis website as ${escapeHtml(p.role)}. Set your password to get started. The link is valid for 7 days and works once.</p>${button(String(p.link), "Accept invitation")}`;
      return { html: layout("You're invited", body), text: `Hi ${p.name},\n\n${p.inviter} invited you to manage the LexPraxis website as ${p.role}. Set your password (valid 7 days):\n\n${p.link}` };
    }
    case "auth.reset": {
      const body = `<p style="margin-top:0">Hi ${escapeHtml(p.name)},</p><p>Use this link to choose a new password for the LexPraxis admin. It expires in 60 minutes and works once.</p>${button(String(p.link), "Choose a new password")}<p style="color:#4a5366;font-size:13px">If you didn't ask for this, you can ignore this email.</p>`;
      return { html: layout("Reset your password", body), text: `Hi ${p.name},\n\nChoose a new password (expires in 60 minutes):\n\n${p.link}\n\nIf you didn't ask for this, ignore this email.` };
    }
  }
}
