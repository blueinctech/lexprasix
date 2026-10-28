// Reads the rendered Gravity Forms and Contact Form 7 markup from the WordPress
// page export and writes one JSON definition per form. These are a starting
// point for src/forms/definitions; recipients and notifications still have to
// be confirmed in the WordPress admin (they are not exposed publicly).
//
//   node scripts/extract-forms.mjs [exportDir] [outDir]
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";

const exportDir = process.argv[2] ?? "migration/wp-export";
const outDir = process.argv[3] ?? "migration/forms";
const pages = JSON.parse(await readFile(path.join(exportDir, "pages.json"), "utf8"));
const text = (el) => (el?.text ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

function gravityFields(form) {
  return form.querySelectorAll(".gfield").map((f) => {
    const cls = f.getAttribute("class") ?? "";
    const type = cls.match(/gfield--type-([a-z_]+)/)?.[1] ?? "unknown";
    const label = text(f.querySelector(".gfield_label, .gsection_title, legend")).replace(/\(Required\)|\*$/g, "").trim();
    const field = {
      id: f.getAttribute("id")?.replace(/^field_\d+_/, ""),
      type,
      label,
      required: cls.includes("gfield_contains_required"),
    };
    const desc = text(f.querySelector(".gfield_description:not(.validation_message)"));
    if (desc) field.description = desc;
    if (type === "html") field.html = f.querySelector(".gfield_html")?.innerHTML.trim() ?? f.innerHTML.trim();
    if (type === "section") field.description = text(f.querySelector(".gsection_description")) || undefined;
    const options = f.querySelectorAll("select option").map((o) => text(o)).filter((o) => o && !/^select/i.test(o));
    const choices = f.querySelectorAll(".gchoice label").map((l) => text(l));
    if (options.length) field.choices = options;
    if (choices.length) field.choices = choices;
    if (type === "name") field.inputs = f.querySelectorAll(".name_first, .name_last, .name_middle, .name_prefix, .name_suffix").map((s) => text(s.querySelector("label")));
    if (type === "address") field.inputs = f.querySelectorAll("span[class*=address_] label").map((l) => text(l));
    if (type === "fileupload") {
      const input = f.querySelector("input[type=file]");
      field.accept = input?.getAttribute("accept") ?? "";
      field.multiple = Boolean(f.querySelector(".gform_fileupload_multifile"));
      field.rules = text(f.querySelector(".gform_fileupload_rules"));
    }
    const placeholder = f.querySelector("input[placeholder], textarea[placeholder]")?.getAttribute("placeholder");
    if (placeholder) field.placeholder = placeholder;
    return field;
  });
}

const forms = [];
for (const page of pages) {
  // Inline scripts (an Elementor add-on emits one before some forms) confuse the parser.
  const root = parse(page.content.rendered.replace(/<script[\s\S]*?<\/script>/gi, ""));
  const pagePath = new URL(page.link).pathname;
  // Parse each Gravity Form on its own: inside some Elementor widgets the parser
  // drops the nested markup when given the whole page.
  const html = page.content.rendered.replace(/<script[\s\S]*?<\/script>/gi, "");
  for (const m of html.matchAll(/<div[^>]+id=['"]gform_wrapper_(\d+)['"]/g)) {
    const end = html.indexOf("</form>", m.index);
    const wrap = parse(html.slice(m.index, end + 7)).firstChild;
    const id = m[1];
    forms.push({
      engine: "gravityforms",
      wpFormId: Number(id),
      title: text(wrap.querySelector(".gform_title")) || page.title.rendered,
      description: text(wrap.querySelector(".gform_description")),
      page: pagePath,
      pageTitle: page.title.rendered,
      multiPage: wrap.querySelectorAll(".gform_page").length > 1,
      submitLabel: wrap.querySelector("input[type=submit], button[type=submit]")?.getAttribute("value") ?? text(wrap.querySelector("button[type=submit]")),
      fields: gravityFields(wrap),
    });
  }
  for (const wrap of root.querySelectorAll(".wpcf7")) {
    const id = wrap.getAttribute("id")?.match(/wpcf7-f(\d+)/)?.[1];
    const fields = wrap.querySelectorAll("input, textarea, select").filter((i) => !["hidden", "submit"].includes(i.getAttribute("type") ?? "")).map((i) => ({
      name: i.getAttribute("name"),
      type: i.tagName === "INPUT" ? i.getAttribute("type") : i.tagName.toLowerCase(),
      required: (i.getAttribute("class") ?? "").includes("wpcf7-validates-as-required") || i.hasAttribute("aria-required"),
      placeholder: i.getAttribute("placeholder") ?? undefined,
      label: text(i.closest("label")) || undefined,
    }));
    forms.push({ engine: "contact-form-7", wpFormId: Number(id), title: page.title.rendered, page: pagePath, fields, submitLabel: wrap.querySelector("[type=submit]")?.getAttribute("value") });
  }
}

await mkdir(outDir, { recursive: true });
for (const f of forms) await writeFile(path.join(outDir, `${f.engine === "gravityforms" ? "gf" : "cf7"}-${f.wpFormId}.json`), JSON.stringify(f, null, 2));
const summary = forms.map((f) => ({
  engine: f.engine,
  id: f.wpFormId,
  page: f.page,
  title: f.title,
  fields: f.fields.filter((x) => !["html", "section"].includes(x.type)).length,
  required: f.fields.filter((x) => x.required).length,
  uploads: f.fields.filter((x) => x.type === "fileupload").length,
  multiPage: f.multiPage ?? false,
}));
await writeFile(path.join(outDir, "index.json"), JSON.stringify(summary, null, 2));
console.table(summary);
