// Form definitions are plain JSON-serialisable data: the same object drives the
// client renderer (FormRenderer) and server validation (validate.ts).

export type FieldType = "text" | "email" | "tel" | "number" | "textarea" | "select" | "radio" | "checkbox" | "date" | "file" | "consent";

export type FieldDef = {
  kind: "field";
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  choices?: string[];
  /** Files: accepted extensions (".pdf") and how many. */
  accept?: string[];
  maxFiles?: number;
  /** Layout hint on wide screens. */
  width?: "full" | "half";
  /** Which submission column this value fills. */
  role?: "name" | "email" | "phone";
};

export type NoteDef = { kind: "note"; id: string; text: string; style: "subheading" | "paragraph" };

export type StepDef = { title: string; description?: string; items: (FieldDef | NoteDef)[] };

export type FormDefinition = {
  id: string;
  title: string;
  kind: "contact" | "document" | "newsletter";
  description?: string;
  steps: StepDef[];
  submitLabel: string;
  /** Shown after a successful submit and in the client confirmation email. */
  successMessage: string;
  /** Source of the definition, for traceability. */
  legacy?: { engine: "gravityforms" | "contact-form-7"; id: number };
};

export const DEFAULT_ACCEPT = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

export function fieldsOf(def: FormDefinition): FieldDef[] {
  return def.steps.flatMap((s) => s.items.filter((i): i is FieldDef => i.kind === "field"));
}
