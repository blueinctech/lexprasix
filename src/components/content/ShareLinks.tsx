"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

// Plain share links (no third-party scripts) plus copy-link.
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { name: "LinkedIn", icon: "linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { name: "X", icon: "x", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { name: "WhatsApp", icon: "whatsapp", href: `https://wa.me/?text=${t}%20${u}` },
    { name: "Facebook", icon: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase">Share</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.name}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-full border border-line text-ink-muted hover:border-navy-900 hover:text-navy-900">
              <Icon name={l.icon} className="size-4" label={`Share on ${l.name}`} />
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })}
            className="grid size-10 place-items-center rounded-full border border-line text-ink-muted hover:border-navy-900 hover:text-navy-900"
          >
            <Icon name={copied ? "check" : "external"} className="size-4" label={copied ? "Link copied" : "Copy link"} />
          </button>
        </li>
      </ul>
    </div>
  );
}
