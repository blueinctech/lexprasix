"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

// Scroll-snap carousel with the theme's round gold arrow buttons beside the
// heading. Works without JavaScript (the track scrolls by swipe/trackpad);
// the arrows move one card at a time. Like the live site's sliders it advances
// on its own every 6 seconds and loops, pausing while the visitor hovers,
// focuses or touches it, while it is off screen, and when reduced motion is set.
const AUTOPLAY_MS = 6000;

export function Carousel({ header, children, label, itemClass = "basis-full md:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-3rem)/3)]", centered = false, autoplay = true }: { header: ReactNode; children: ReactNode[]; label: string; itemClass?: string; centered?: boolean; autoplay?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);

  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.getBoundingClientRect().width + 24 : el.clientWidth;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (dir === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else if (dir === -1 && el.scrollLeft <= 4) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    else el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  useEffect(() => {
    const el = track.current;
    const box = root.current;
    if (!autoplay || !el || !box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    let held = false;
    const hold = () => (held = true);
    const release = () => (held = box.contains(document.activeElement) && document.activeElement !== document.body);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    box.addEventListener("pointerenter", hold);
    box.addEventListener("pointerleave", release);
    box.addEventListener("focusin", hold);
    box.addEventListener("focusout", () => setTimeout(release));
    el.addEventListener("touchstart", hold, { passive: true });
    el.addEventListener("touchend", () => setTimeout(release, AUTOPLAY_MS), { passive: true });
    const timer = setInterval(() => {
      if (visible && !held && document.visibilityState === "visible" && el.scrollWidth > el.clientWidth + 4) move(1);
    }, AUTOPLAY_MS);
    return () => {
      clearInterval(timer);
      io.disconnect();
      box.removeEventListener("pointerenter", hold);
      box.removeEventListener("pointerleave", release);
      box.removeEventListener("focusin", hold);
    };
    // move only reads the track ref.
  }, [autoplay]);

  const arrowCls = "grid size-14 place-items-center rounded-full bg-gold-500 text-white transition-colors hover:bg-navy-700";
  if (centered) {
    // Heading centred above; arrows sit on the sides of the track (as on the services slider).
    return (
      <div ref={root}>
        {header}
        <div className="relative">
          <div ref={track} role="region" aria-label={label} tabIndex={0} className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {children.map((child, i) => (
              <div key={i} className={`shrink-0 snap-start ${itemClass}`}>
                {child}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => move(-1)} className={`${arrowCls} absolute top-1/2 -left-4 -translate-y-1/2 xl:-left-7`}>
            <Icon name="arrow-left" className="size-5" label={`Previous ${label}`} />
          </button>
          <button type="button" onClick={() => move(1)} className={`${arrowCls} absolute top-1/2 -right-4 -translate-y-1/2 xl:-right-7`}>
            <Icon name="arrow-right" className="size-5" label={`Next ${label}`} />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div ref={root}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        {header}
        <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} className="grid size-14 place-items-center rounded-full bg-gold-500 text-white transition-colors hover:bg-navy-700">
            <Icon name="arrow-left" className="size-5" label={`Previous ${label}`} />
          </button>
          <button type="button" onClick={() => move(1)} className="grid size-14 place-items-center rounded-full bg-gold-500 text-white transition-colors hover:bg-navy-700">
            <Icon name="arrow-right" className="size-5" label={`Next ${label}`} />
          </button>
        </div>
      </div>
      <div ref={track} role="region" aria-label={label} tabIndex={0} className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children.map((child, i) => (
          <div key={i} className={`shrink-0 snap-start ${itemClass}`}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
