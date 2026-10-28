// Converts the extracted Gravity Forms (migration/forms/gf-*.json) into form
// definitions for the new site (src/forms/definitions/<page-slug>.json).
// Each Gravity Forms section becomes a step; fields before the first section
// become a "Your details" step. Rerun after re-extracting; review the diff.
//
//   node scripts/build-form-definitions.mjs
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";

const SRC = "migration/forms";
const OUT = "src/forms/definitions";
await mkdir(OUT, { recursive: true });

const TYPE_MAP = {
  text: "text", email: "email", phone: "tel", number: "tel", textarea: "textarea", select: "select", radio: "radio",
  checkbox: "checkbox", date: "date", fileupload: "file", name: "text", address: "textarea", website: "text", consent: "consent",
};

const clean = (s = "") => s.replace(/\s*\*\s*$/, "").replace(/\s+/g, " ").trim();
const htmlText = (html = "") => parse(html).text.replace(/ /g, " ").replace(/\s+/g, " ").trim();

const index = [];
for (const file of (await readdir(SRC)).filter((f) => /^gf-\d+\.json$/.test(f))) {
  const gf = JSON.parse(await readFile(path.join(SRC, file), "utf8"));
  const slug = gf.page.replace(/^\/|\/$/g, "");
  const steps = [];
  let current = { title: "Your details", items: [] };
  const roles = new Set();
  for (const f of gf.fields) {
    if (f.type === "section") {
      if (current.items.length) steps.push(current);
      const title = clean(f.label).replace(/^section\s*\d+\s*\/\s*\d+\s*:\s*/i, "");
      current = { title: title.charAt(0) + title.slice(1).toLowerCase().replace(/\b(cac|tin|vat|us|uk|nda|llc|ltd|rc|bn|id|nin)\b/g, (m) => m.toUpperCase()), items: [] };
      if (f.description) current.description = f.description;
      continue;
    }
    if (f.type === "html") {
      const text = htmlText(f.html);
      if (text) current.items.push({ kind: "note", id: `n${f.id}`, text, style: text.length <= 60 ? "subheading" : "paragraph" });
      continue;
    }
    if (f.type === "page" || f.type === "captcha" || f.type === "hidden") continue;
    const type = TYPE_MAP[f.type];
    if (!type) {
      console.warn(`${file}: unsupported field type ${f.type} (${f.label}) — skipped`);
      continue;
    }
    const label = clean(f.label) || (f.type === "name" ? "Full name" : f.type === "address" ? "Address" : `Field ${f.id}`);
    const field = { kind: "field", id: `f${f.id}`, type, label, required: Boolean(f.required) };
    if (f.description) field.description = f.description;
    if (f.placeholder) field.placeholder = f.placeholder;
    if (f.choices?.length) field.choices = [...new Set(f.choices.map(clean).filter((c) => c && !/^choose /i.test(c)))];
    if (type === "file") {
      const acc = (f.accept || "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean).map((a) => (a.startsWith(".") ? a : `.${a}`));
      field.accept = acc.length ? acc : [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];
      field.maxFiles = f.multiple ? 5 : 1;
    }
    if (type === "textarea") field.width = "full";
    // First name/email/phone fields identify the client in the admin inbox.
    if (!roles.has("name") && (f.type === "name" || /^(your )?(full )?name$/i.test(label))) {
      field.role = "name";
      roles.add("name");
    } else if (!roles.has("email") && type === "email") {
      field.role = "email";
      roles.add("email");
    } else if (!roles.has("phone") && (f.type === "phone" || /phone/i.test(label))) {
      field.role = "phone";
      field.type = "tel";
      roles.add("phone");
    }
    current.items.push(field);
  }
  if (current.items.length) steps.push(current);
  const def = {
    id: slug,
    title: gf.pageTitle.replace(/&#038;|&amp;/g, "&"),
    kind: "document",
    steps,
    submitLabel: "Submit request",
    successMessage: "Thank you. We have received your information and a member of our legal team will contact you within one business day to confirm the next steps and any fees.",
    legacy: { engine: "gravityforms", id: gf.wpFormId },
  };
  await writeFile(path.join(OUT, `${slug}.json`), JSON.stringify(def, null, 2) + "\n");
  const fields = steps.flatMap((s) => s.items.filter((i) => i.kind === "field"));
  index.push({ slug, steps: steps.length, fields: fields.length, required: fields.filter((x) => x.required).length, roles: [...roles].join(",") });
}
console.table(index);
