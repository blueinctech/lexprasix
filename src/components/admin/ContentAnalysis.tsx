"use client";

import { useEffect, useRef, useState } from "react";
import { highlightInEditor } from "./analysisHighlight";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const inputCls = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";

// Live SEO and readability analysis while writing, using Yoast's own analysis
// engine (the open-source `yoastseo` package, the same checks as the free Yoast
// plugin). It reads the surrounding editor form every couple of seconds, so it
// follows the title, slug, meta description, focus keyphrase and article text
// as they change. Advisory only: it never blocks saving or publishing.

type Rating = "good" | "ok" | "bad" | "na";
type Item = { id: string; rating: Rating; html: string; marks: string[] };
type Result = { seo: { score: number; items: Item[] } | null; read: { score: number; items: Item[] } };

const DOT: Record<Rating, string> = { good: "bg-emerald-500", ok: "bg-amber-400", bad: "bg-red-500", na: "bg-slate-300" };
const LABEL: Record<Rating, string> = { good: "Good", ok: "OK", bad: "Needs improvement", na: "Not analysed" };

/** Yoast's thresholds: per check 8–10 good, 5–7 ok, 1–4 bad; overall >70 good, >40 ok. */
const itemRating = (score: number): Rating => (score > 7 ? "good" : score > 4 ? "ok" : score > 0 ? "bad" : "na");
const overallRating = (score: number): Rating => (score > 70 ? "good" : score > 40 ? "ok" : "bad");
const ORDER: Record<Rating, number> = { bad: 0, ok: 1, good: 2, na: 3 };

type Snapshot = { html: string; featured: { url: string; alt: string } | null; keyword: string; title: string; seoTitle: string; description: string; excerpt: string; slug: string };

function read(form: HTMLFormElement): Snapshot {
  const fd = new FormData(form);
  const v = (k: string) => String(fd.get(k) ?? "");
  const fi = form.querySelector<HTMLInputElement>("input[name=featuredImageId]");
  const featured = fi?.value && fi.dataset.url ? { url: fi.dataset.url, alt: fi.dataset.alt ?? "" } : null;
  return { html: v("html"), featured, keyword: v("seo_focusKeyphrase").trim(), title: v("title"), seoTitle: v("seo_title"), description: v("seo_description"), excerpt: v("excerpt"), slug: v("slug") };
}

async function analyse(s: Snapshot, titleSuffix: string): Promise<Result> {
  const [{ Paper, assessors }, researcherMod] = await Promise.all([import("yoastseo"), import("yoastseo/build/languageProcessing/languages/en/Researcher")]);
  const Researcher = (researcherMod as unknown as { default: new (p: unknown) => unknown }).default;
  const title = (s.seoTitle || `${s.title}${titleSuffix}`).trim();
  // Like Yoast on WordPress, the featured image counts towards the image checks.
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = s.featured ? `${s.html}<img src="${esc(s.featured.url)}" alt="${esc(s.featured.alt)}">` : s.html;
  const paper = new Paper(html, {
    keyword: s.keyword,
    title,
    titleWidth: measure(title),
    description: s.description || s.excerpt,
    slug: s.slug,
    locale: "en_US",
    permalink: `https://lexpraxisng.com/${s.slug}/`,
  });
  const researcher = new Researcher(paper);
  // Yoast hands each check's marks to this function; they become the eye-button highlights.
  let captured: YoastMark[] = [];
  const marker = { marker: (_paper: unknown, marks: YoastMark[]) => void (captured = marks ?? []) };
  const marksOf = (r: YoastResult): string[] => {
    if (!r.hasMarks()) return [];
    captured = [];
    try {
      r.getMarker()();
    } catch {
      return [];
    }
    const out = captured.map((m) => {
      const pos = m.getPosition?.();
      // Newer checks point at a range of the article's HTML; older ones give the sentence itself.
      const source = pos && pos.endOffset > pos.startOffset ? html.slice(pos.startOffset, pos.endOffset) : m.getOriginal();
      return plain(source);
    });
    return [...new Set(out.filter((t) => t.length > 1))];
  };
  const collect = (a: { assess: (p: unknown) => void; getValidResults: () => YoastResult[]; calculateOverallScore: () => number }) => {
    a.assess(paper);
    const items = a
      .getValidResults()
      .filter((r) => r.getText())
      .map((r) => ({ id: r.getIdentifier(), rating: itemRating(r.getScore()), html: r.getText(), marks: marksOf(r) }))
      .sort((x, y) => ORDER[x.rating] - ORDER[y.rating]);
    return { score: a.calculateOverallScore() ?? 0, items };
  };
  const read = collect(new assessors.ContentAssessor(researcher, marker) as never);
  const seo = s.keyword ? collect(new assessors.SEOAssessor(researcher, marker) as never) : null;
  return { seo, read };
}

type YoastMark = { getOriginal(): string; getPosition?(): { startOffset: number; endOffset: number } | undefined };
type YoastResult = { getScore(): number; getText(): string; getIdentifier(): string; hasMarks(): boolean; getMarker(): () => void };

/** HTML fragment to the plain text the editor shows. */
function plain(html: string): string {
  const text = html.replace(/<[^>]*>/g, "").replace(/<[^>]*$/, "").replace(/^[^<]*>/, "");
  if (typeof document === "undefined") return text.replace(/\s+/g, " ").trim();
  const t = document.createElement("textarea");
  t.innerHTML = text;
  return t.value.replace(/\s+/g, " ").trim();
}

/** Pixel width of the title as Google shows it (Arial 20px), like Yoast's title width check. */
function measure(text: string): number {
  if (typeof document === "undefined") return text.length * 9;
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return text.length * 9;
  c.font = "20px Arial";
  return Math.round(c.measureText(text).width);
}

/** Links in Yoast's messages point to yoa.st articles; open them in a new tab. */
function messageHtml(html: string): string {
  return html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" class="underline" ');
}

export function ContentAnalysis({ initialKeyphrase, titleSuffix = " - Lexpraxis Solicitors" }: { initialKeyphrase: string; titleSuffix?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [keyphrase, setKeyphrase] = useState(initialKeyphrase);
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"seo" | "read">("seo");
  // The check whose sentences are highlighted in the article ("seo:keyphraseDensity").
  const [shown, setShown] = useState<string | null>(null);
  const sent = useRef("");

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    let last = "";
    let running = false;
    let cancelled = false;
    const run = async () => {
      if (running) return;
      const snap = read(form);
      const key = JSON.stringify(snap);
      if (key === last) return;
      last = key;
      running = true;
      try {
        const r = await analyse(snap, titleSuffix);
        if (!cancelled) {
          setResult(r);
          setFailed(false);
        }
      } catch (err) {
        console.error("Content analysis failed", err);
        if (!cancelled) setFailed(true);
      } finally {
        running = false;
      }
    };
    run();
    const timer = setInterval(run, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [titleSuffix]);

  // Keep the highlights in step with the article as it is edited and re-analysed.
  const shownItem = shown ? (shown.startsWith("seo:") ? result?.seo : result?.read)?.items.find((i) => i.id === shown.slice(shown.indexOf(":") + 1)) : undefined;
  const needles = shownItem?.marks ?? [];
  const needlesKey = JSON.stringify(needles);
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form || needlesKey === sent.current) return;
    const first = sent.current === "" || sent.current === "[]";
    sent.current = needlesKey;
    highlightInEditor(form, JSON.parse(needlesKey) as string[], first);
  }, [needlesKey]);

  const current = tab === "seo" ? result?.seo : result?.read;
  return (
    <div ref={box} className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">SEO &amp; readability</h2>
        <p className="mt-0.5 text-xs text-slate-500">Live analysis by Yoast&apos;s engine. Advice only; it never stops you publishing.</p>
      </div>
      <div className="grid gap-1.5 px-4 pt-4">
        <label htmlFor="seo_focusKeyphrase" className="text-sm font-medium text-slate-800">
          Focus keyphrase
        </label>
        <input id="seo_focusKeyphrase" name="seo_focusKeyphrase" value={keyphrase} onChange={(e) => setKeyphrase(e.target.value)} maxLength={120} placeholder="e.g. register a company in Nigeria" className={inputCls} />
        <span className="text-xs text-slate-500">The search phrase you want this article to rank for.</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1 px-4" role="tablist">
        {(
          [
            ["seo", "SEO", result?.seo ? overallRating(result.seo.score) : "na"],
            ["read", "Readability", result ? overallRating(result.read.score) : "na"],
          ] as const
        ).map(([id, label, rating]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx("flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium", tab === id ? "bg-navy-50 text-navy-900" : "text-slate-600 hover:bg-slate-50")}
          >
            <span className={cx("size-2.5 rounded-full", DOT[rating])} aria-hidden="true" />
            {label}
            <span className="sr-only">: {LABEL[rating]}</span>
          </button>
        ))}
      </div>
      <div className="px-4 pt-3 pb-4">
        {failed ? (
          <p className="text-sm text-red-700">The analysis couldn&apos;t run. Your article is not affected; try reloading the page.</p>
        ) : !result ? (
          <p className="text-sm text-slate-500">Analysing…</p>
        ) : tab === "seo" && !result.seo ? (
          <p className="text-sm text-slate-600">Enter a focus keyphrase above to see the SEO analysis.</p>
        ) : (
          <ul className="grid max-h-[28rem] gap-2.5 overflow-y-auto pr-1">
            {current?.items.map((i) => (
              <li key={i.id} className="flex gap-2.5 text-sm leading-snug text-slate-700">
                <span className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[i.rating])} aria-label={LABEL[i.rating]} role="img" />
                <span className="flex-1" dangerouslySetInnerHTML={{ __html: messageHtml(i.html) }} />
                {i.marks.length > 0 && (
                  <EyeButton
                    on={shown === `${tab}:${i.id}`}
                    count={i.marks.length}
                    onClick={() => setShown((s) => (s === `${tab}:${i.id}` ? null : `${tab}:${i.id}`))}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Yoast's eye button: highlights the sentences a check is about in the article. */
function EyeButton({ on, count, onClick }: { on: boolean; count: number; onClick: () => void }) {
  const label = on ? "Hide the highlights in the article" : `Highlight ${count === 1 ? "this" : `these ${count}`} in the article`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      className={cx("-mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border", on ? "border-navy-900 bg-navy-900 text-white" : "border-slate-300 text-slate-600 hover:bg-slate-100")}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}
