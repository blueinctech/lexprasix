"use client";

import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnalysisHighlight, applyHighlights, HIGHLIGHT_EVENT, type HighlightDetail } from "./analysisHighlight";
import { MediaBrowser } from "./MediaPicker";

// Rich-text editor for articles and page text. Writes HTML into a hidden input
// named `name`; the server sanitises it again before saving.

export function RichTextEditor({ name, initialHtml, label = "Content", minHeight = "18rem", onChange }: { name?: string; initialHtml: string; label?: string; minHeight?: string; onChange?: (html: string) => void }) {
  const [html, setHtml] = useState(initialHtml);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // TipTap adds rel="noopener noreferrer nofollow" to every link by default; nofollow tells
      // Google to ignore the link, so links get no rel here (new-tab links get noopener on save).
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: null } } }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
      // YouTube videos: inserted with the toolbar button, and kept when older articles with videos are edited.
      Youtube.configure({ nocookie: true, controls: true, modestBranding: true, width: 640, height: 360 }),
      // Shading for the SEO & readability panel's "eye" buttons (never saved).
      AnalysisHighlight,
    ],
    content: initialHtml,
    editorProps: { attributes: { class: "prose-lp max-w-none px-4 py-3 focus:outline-none", "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: e }) => {
      const next = e.getHTML();
      setHtml(next);
      onChange?.(next);
    },
  });

  // The SEO & readability panel in the same form asks for highlights with an event.
  useEffect(() => {
    const form = wrap.current?.closest("form");
    if (!form || !editor || name !== "html") return;
    const onHighlight = (e: Event) => {
      const { needles, scroll } = (e as CustomEvent<HighlightDetail>).detail;
      applyHighlights(editor.view, needles, scroll);
    };
    form.addEventListener(HIGHLIGHT_EVENT, onHighlight);
    return () => form.removeEventListener(HIGHLIGHT_EVENT, onHighlight);
  }, [editor, name]);

  return (
    <div ref={wrap} data-field className="grid gap-1.5">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {name && <input type="hidden" name={name} value={html} />}
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-navy-700 focus-within:ring-2 focus-within:ring-navy-700/15">
        {editor ? <Toolbar editor={editor} onImage={() => setPickerOpen(true)} /> : <div className="h-10 border-b border-slate-200 bg-slate-50" />}
        <div style={{ minHeight }} className="max-h-[70vh] overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
      <MediaBrowser
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(m) => {
          if (editor?.chain().focus().setImage({ src: m.url, alt: m.alt }).run()) editor.commands.createParagraphNear();
        }}
      />
    </div>
  );
}

function Toolbar({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      h4: e.isActive("heading", { level: 4 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      image: e.isActive("image"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) return c().extendMarkRange("link").unsetLink().run();
    const external = /^https?:\/\//.test(url) && !/lexpraxisng\.com/.test(url);
    c().extendMarkRange("link").setLink({ href: url.trim(), target: external ? "_blank" : null }).run();
  };
  const youtube = () => {
    const url = window.prompt("Paste the YouTube video link (e.g. https://www.youtube.com/watch?v=… or https://youtu.be/…)");
    if (!url?.trim()) return;
    // Move to a new line after the video, so the next insert doesn't replace it.
    if (c().setYoutubeVideo({ src: url.trim() }).run()) editor.commands.createParagraphNear();
    else window.alert("That doesn't look like a YouTube video link. Copy it from the Share button under the video on YouTube.");
  };
  // Alt text lives on each image in the article (copied from the media library when inserted).
  const altText = () => {
    const prev = (editor.getAttributes("image").alt as string | undefined) ?? "";
    const alt = window.prompt("Describe this image for search engines and screen readers (alt text). Include your keyphrase where it fits naturally.", prev);
    if (alt === null) return;
    c().updateAttributes("image", { alt: alt.trim() }).run();
  };
  const imageByUrl = () => {
    const url = window.prompt("Image URL");
    if (!url) return;
    const alt = window.prompt("Describe the image for screen readers (alt text)") ?? "";
    if (c().setImage({ src: url, alt }).run()) editor.commands.createParagraphNear();
  };
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-1">
      <T label="Heading 2" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</T>
      <T label="Heading 3" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>H3</T>
      <T label="Heading 4" active={s.h4} onClick={() => c().toggleHeading({ level: 4 }).run()}>H4</T>
      <Sep />
      <T label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
        <strong>B</strong>
      </T>
      <T label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
        <em>I</em>
      </T>
      <T label="Link" active={s.link} onClick={setLink}>Link</T>
      <Sep />
      <T label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>• List</T>
      <T label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>1. List</T>
      <T label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>“ ”</T>
      <T label="Divider" onClick={() => c().setHorizontalRule().run()}>—</T>
      <Sep />
      <T label="Image from media library" onClick={onImage}>Image</T>
      <T label="Image from URL" onClick={imageByUrl}>Img URL</T>
      <T label="YouTube video" onClick={youtube}>▶ YouTube</T>
      {s.image && <T label="Alt text for the selected image" onClick={altText}>Alt text</T>}
      {!s.table ? (
        <T label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</T>
      ) : (
        <>
          <T label="Add row" onClick={() => c().addRowAfter().run()}>+Row</T>
          <T label="Add column" onClick={() => c().addColumnAfter().run()}>+Col</T>
          <T label="Delete row" onClick={() => c().deleteRow().run()}>−Row</T>
          <T label="Delete column" onClick={() => c().deleteColumn().run()}>−Col</T>
          <T label="Delete table" onClick={() => c().deleteTable().run()}>×Table</T>
        </>
      )}
      <Sep />
      <T label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>Undo</T>
      <T label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>Redo</T>
    </div>
  );
}

function T({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active ?? undefined}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-8 min-w-8 rounded px-2 text-xs font-medium transition-colors disabled:opacity-40 ${active ? "bg-navy-900 text-white" : "text-slate-700 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />;
}
