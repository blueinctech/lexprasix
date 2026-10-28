import { describe, expect, it } from "vitest";
import { allForms, getFormDefinition } from "@/forms/registry";
import { fieldsOf, type FieldDef } from "@/forms/types";
import { contactOf, validateField, validateForm } from "@/forms/validate";

const field = (over: Partial<FieldDef>): FieldDef => ({ kind: "field", id: "x", type: "text", label: "X", required: true, ...over });

describe("form definitions", () => {
  const forms = allForms();

  it("include the contact form, newsletter and all 23 legal-document forms", () => {
    expect(forms.filter((f) => f.kind === "document")).toHaveLength(23);
    expect(getFormDefinition("contact")).toBeTruthy();
    expect(getFormDefinition("newsletter")).toBeTruthy();
  });

  it.each(forms.map((f) => [f.id, f] as const))("%s has unique field ids, an email field and valid choices", (_id, def) => {
    const fields = fieldsOf(def);
    const ids = fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fields.some((f) => f.type === "email")).toBe(true);
    for (const f of fields) {
      if (["select", "radio", "checkbox"].includes(f.type)) expect(f.choices?.length).toBeGreaterThan(0);
      if (f.type === "file") expect(f.accept?.every((a) => a.startsWith("."))).toBe(true);
    }
    expect(def.steps.length).toBeGreaterThan(0);
  });
});

describe("validateField", () => {
  it("requires required fields", () => {
    expect(validateField(field({}), "")).toMatch(/required/);
    expect(validateField(field({ required: false }), "")).toBeNull();
  });
  it("validates emails and phones", () => {
    expect(validateField(field({ type: "email" }), "not-an-email")).toBeTruthy();
    expect(validateField(field({ type: "email" }), "a@b.co")).toBeNull();
    expect(validateField(field({ type: "tel" }), "call me")).toBeTruthy();
    expect(validateField(field({ type: "tel" }), "+234 803 000 0000")).toBeNull();
  });
  it("only accepts listed choices", () => {
    const f = field({ type: "select", choices: ["A", "B"] });
    expect(validateField(f, "C")).toBeTruthy();
    expect(validateField(f, "A")).toBeNull();
    const c = field({ type: "checkbox", choices: ["A", "B"] });
    expect(validateField(c, ["A", "Z"])).toBeTruthy();
    expect(validateField(c, ["A", "B"])).toBeNull();
  });
  it("rejects malformed upload ids and too many files", () => {
    const f = field({ type: "file", maxFiles: 1 });
    expect(validateField(f, ["../../etc/passwd"])).toBeTruthy();
    expect(validateField(f, ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"])).toBeTruthy();
  });
  it("caps text length", () => {
    expect(validateField(field({}), "x".repeat(501))).toBeTruthy();
    expect(validateField(field({ type: "textarea" }), "x".repeat(8001))).toBeTruthy();
  });
});

describe("validateForm", () => {
  const def = getFormDefinition("contact")!;
  it("drops unknown keys and trims values", () => {
    const res = validateForm(def, { name: "  Ada  ", email: "ada@example.com", phone: "+234 803 000 0000", message: "Hello", injected: "<script>" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.values.name).toBe("Ada");
      expect(res.values).not.toHaveProperty("injected");
      expect(contactOf(def, res.values)).toEqual({ name: "Ada", email: "ada@example.com", phone: "+234 803 000 0000" });
    }
  });
  it("returns field errors", () => {
    const res = validateForm(def, { email: "bad" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors).sort()).toEqual(["email", "message", "name", "phone"]);
  });
});
