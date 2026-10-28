import { fieldsOf, type FieldDef, type FormDefinition } from "./types";

// Validation shared by the browser (per step, for instant feedback) and the
// server (authoritative, whole form). Values arrive as strings, string arrays
// (checkboxes) or upload ids (files).

export type FormValues = Record<string, string | string[]>;
export type FieldErrors = Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+()\-\s\d]{7,20}$/;
const MAX_TEXT = 500;
const MAX_TEXTAREA = 8000;

export function validateField(field: FieldDef, raw: string | string[] | undefined): string | null {
  const value = raw ?? (field.type === "checkbox" || field.type === "file" ? [] : "");
  const empty = Array.isArray(value) ? value.length === 0 : value.trim() === "";
  if (empty) return field.required ? (field.type === "consent" ? "Please confirm to continue." : "This field is required.") : null;

  if (Array.isArray(value)) {
    if (field.type === "checkbox") {
      if (value.some((v) => !field.choices?.includes(v))) return "Please choose from the listed options.";
      return null;
    }
    if (field.type === "file") {
      if (value.length > (field.maxFiles ?? 1)) return `Upload at most ${field.maxFiles ?? 1} file(s).`;
      if (value.some((v) => !/^[0-9a-f-]{36}$/i.test(v))) return "Upload failed. Please try again.";
      return null;
    }
    return "Invalid value.";
  }

  const v = value.trim();
  switch (field.type) {
    case "email":
      return v.length > 254 || !EMAIL.test(v) ? "Enter a valid email address." : null;
    case "tel":
      return PHONE.test(v) ? null : "Enter a valid phone number, e.g. +234 803 000 0000.";
    case "number":
      return /^-?\d+(\.\d+)?$/.test(v.replace(/,/g, "")) ? null : "Enter a number.";
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : "Enter a valid date.";
    case "select":
    case "radio":
      return field.choices?.includes(v) ? null : "Please choose from the listed options.";
    case "consent":
      return v === "yes" ? null : "Please confirm to continue.";
    case "textarea":
      return v.length > MAX_TEXTAREA ? `Keep this under ${MAX_TEXTAREA} characters.` : null;
    default:
      return v.length > MAX_TEXT ? `Keep this under ${MAX_TEXT} characters.` : null;
  }
}

export function validateFields(fields: FieldDef[], values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  for (const f of fields) {
    const err = validateField(f, values[f.id]);
    if (err) errors[f.id] = err;
  }
  return errors;
}

/** Whole-form validation; returns cleaned values containing only known fields. */
export function validateForm(def: FormDefinition, input: unknown): { ok: true; values: FormValues } | { ok: false; errors: FieldErrors } {
  const values: FormValues = {};
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  for (const f of fieldsOf(def)) {
    const raw = src[f.id];
    if (Array.isArray(raw)) values[f.id] = raw.filter((x): x is string => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 500));
    else if (typeof raw === "string") values[f.id] = raw.slice(0, MAX_TEXTAREA + 1);
  }
  const errors = validateFields(fieldsOf(def), values);
  if (Object.keys(errors).length) return { ok: false, errors };
  for (const k of Object.keys(values)) if (typeof values[k] === "string") values[k] = (values[k] as string).trim();
  return { ok: true, values };
}

/** Contact details used for the inbox and the confirmation email. */
export function contactOf(def: FormDefinition, values: FormValues): { name: string; email: string; phone: string } {
  const fields = fieldsOf(def);
  const pick = (role: "name" | "email" | "phone", fallback: (f: FieldDef) => boolean) => {
    const f = fields.find((x) => x.role === role) ?? fields.find(fallback);
    const v = f ? values[f.id] : "";
    return typeof v === "string" ? v : "";
  };
  return {
    name: pick("name", (f) => f.type === "text" && /\bname\b/i.test(f.label)).slice(0, 200),
    email: pick("email", (f) => f.type === "email").slice(0, 254),
    phone: pick("phone", (f) => f.type === "tel").slice(0, 40),
  };
}
