"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/primitives";

// Third-party embeds load only when needed: maps and reviews on click (they
// set cookies and are heavy), Calendly when scrolled near.

export function ConsentEmbed({ title, src, ratio = "aspect-video", cta = "Load content" }: { title: string; src: string; ratio?: string; cta?: string }) {
  const [on, setOn] = useState(false);
  let host = "";
  try {
    host = new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    <div className={`relative overflow-hidden rounded-xl bg-navy-50 ${ratio}`}>
      {on ? (
        <iframe src={src} title={title} className="absolute inset-0 size-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allow="fullscreen" />
      ) : (
        <button type="button" onClick={() => setOn(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-navy-900 hover:bg-navy-100">
          <Icon name="map-pin" className="size-5 text-gold-700" />
          <span className="font-medium">{cta}</span>
          <span className="text-xs text-ink-muted">Loads content from {host}</span>
        </button>
      )}
    </div>
  );
}

export function CalendlyEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const src = `${url}${url.includes("?") ? "&" : "?"}embed_domain=${typeof window !== "undefined" ? window.location.hostname : "lexpraxisng.com"}&embed_type=Inline&hide_gdpr_banner=1&primary_color=20336d`;
  return (
    <div ref={ref} className="overflow-hidden rounded-[1.5rem] border border-line bg-white">
      {visible ? (
        <iframe src={src} title="Book a consultation with LexPraxis Solicitors" className="h-[720px] w-full border-0" loading="lazy" />
      ) : (
        <div className="grid h-[720px] place-items-center text-ink-muted">Loading calendar…</div>
      )}
      <p className="border-t border-line px-5 py-3 text-xs text-ink-muted">
        Calendar not loading?{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-navy-900 underline">
          Open booking page
        </a>
        .
      </p>
    </div>
  );
}

export function TrustindexWidget({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on || !ref.current) return;
    const s = document.createElement("script");
    s.src = `https://cdn.trustindex.io/loader.js?${encodeURIComponent(id)}`;
    s.defer = true;
    ref.current.appendChild(s);
  }, [on, id]);
  return on ? (
    <div ref={ref} />
  ) : (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-navy-900/20 p-8 text-center">
      <p className="text-ink-muted">Read our verified Google reviews.</p>
      <button type="button" onClick={() => setOn(true)} className={buttonClass("outline")}>
        <Icon name="star" className="size-4 text-gold-600" /> Show Google reviews
      </button>
      <p className="text-xs text-ink-muted">Loads a widget from trustindex.io</p>
    </div>
  );
}
