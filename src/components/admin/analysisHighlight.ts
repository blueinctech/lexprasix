import { Extension } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Yoast-style "eye" highlighting: the SEO & readability panel sends the
// sentences or words a check is about, and the article editor shades them.
// Highlights are editor decorations only; they are never saved in the article.

export const HIGHLIGHT_EVENT = "lp:analysis-highlight";
export type HighlightDetail = { needles: string[]; scroll: boolean };

const key = new PluginKey<DecorationSet>("analysisHighlight");

/** Asks the article editor inside `form` to highlight these text snippets (empty clears). */
export function highlightInEditor(form: HTMLFormElement, needles: string[], scroll = false) {
  form.dispatchEvent(new CustomEvent<HighlightDetail>(HIGHLIGHT_EVENT, { detail: { needles, scroll } }));
}

const norm = (t: string) => t.replace(/\s+/g, " ");

function build(doc: PMNode, needles: string[]): DecorationSet {
  const wanted = [...new Set(needles.map((n) => norm(n).trim()).filter((n) => n.length > 1))];
  if (!wanted.length) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // Text of the block, with a map from each character to its document position.
    let text = "";
    const at: number[] = [];
    node.descendants((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) {
          text += /\s/.test(child.text[i]) ? " " : child.text[i];
          at.push(pos + 1 + offset + i);
        }
      } else if (child.type.name === "hardBreak") {
        text += " ";
        at.push(pos + 1 + offset);
      }
      return true;
    });
    for (const needle of wanted) {
      let from = text.indexOf(needle);
      while (from !== -1) {
        decos.push(Decoration.inline(at[from], at[from + needle.length - 1] + 1, { class: "lp-analysis-mark" }));
        from = text.indexOf(needle, from + needle.length);
      }
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

export const AnalysisHighlight = Extension.create({
  name: "analysisHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const needles = tr.getMeta(key) as string[] | undefined;
            if (needles) return build(tr.doc, needles);
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ];
  },
});

/** Applies highlights to an editor view, and scrolls the first one into view. */
export function applyHighlights(view: import("@tiptap/pm/view").EditorView, needles: string[], scroll: boolean) {
  view.dispatch(view.state.tr.setMeta(key, needles).setMeta("addToHistory", false));
  if (!scroll || !needles.length) return;
  requestAnimationFrame(() => view.dom.querySelector(".lp-analysis-mark")?.scrollIntoView({ block: "center", behavior: "smooth" }));
}
