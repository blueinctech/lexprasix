"use client";

import { useEffect, useRef, useState } from "react";

// Counts the figures in a text up from zero the first time it scrolls into
// view, like the live site's counters ("Join 2k+ Satisfied Clients", "250 +").
// The final text is rendered on the server and kept for screen readers; the
// moving copy is hidden from them. No animation when reduced motion is set.

const NUMBER = /(\d+)(?=\s*k?\s*\+)/g;
const DURATION = 2000;

export function CountUp({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el || !NUMBER.test(text)) return;
    NUMBER.lastIndex = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION);
          setProgress(1 - Math.pow(1 - t, 3));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        setProgress(0);
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [text]);

  const shown = progress >= 1 ? text : text.replace(NUMBER, (n) => String(Math.round(Number(n) * progress)));
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="tabular-nums">
        {shown}
      </span>
    </span>
  );
}
