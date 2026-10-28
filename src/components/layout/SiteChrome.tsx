"use client";

import Script from "next/script";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";
import { buttonClass } from "@/components/ui/primitives";

// Tracking and widgets that sit on every public page:
//  - Google Tag Manager with Consent Mode v2: analytics/ads storage is denied
//    until the visitor accepts (NDPA 2023 / GDPR-style consent).
//  - Tawk.to chat, loaded after the page is idle so it doesn't slow first paint.
//  - WhatsApp click-to-chat button.

const CONSENT_KEY = "lp-consent-v1";
const CONSENT_EVENT = "lp-consent-change";

function readConsent(): Consent | null {
  try {
    return (localStorage.getItem(CONSENT_KEY) as Consent | null) ?? null;
  } catch {
    return null;
  }
}

function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
type Consent = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    Tawk_API?: Record<string, unknown>;
  }
}

export function SiteChrome({ gtmId, tawk, whatsapp }: { gtmId: string; tawk: string; whatsapp: string }) {
  // "unknown" while server-rendering, then the stored choice (null = not asked yet).
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => "unknown" as const);

  const decide = (value: Consent) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* ignore */
    }
    window.gtag?.("consent", "update", { ad_storage: value, analytics_storage: value, ad_user_data: value, ad_personalization: value });
    window.dispatchEvent(new Event(CONSENT_EVENT));
  };

  useEffect(() => {
    if (!tawk) return;
    const load = () => {
      if (document.getElementById("tawk-script")) return;
      window.Tawk_API = window.Tawk_API || {};
      const s = document.createElement("script");
      s.id = "tawk-script";
      s.async = true;
      s.src = `https://embed.tawk.to/${tawk}`;
      s.charset = "UTF-8";
      s.setAttribute("crossorigin", "*");
      document.body.appendChild(s);
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    const onFirst = () => {
      events.forEach((e) => window.removeEventListener(e, onFirst));
      load();
    };
    events.forEach((e) => window.addEventListener(e, onFirst, { once: true, passive: true }));
    const t = setTimeout(load, 8000);
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, onFirst));
    };
  }, [tawk]);

  return (
    <>
      {gtmId && (
        <>
          <Script id="consent-default" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
var c=null;try{c=localStorage.getItem(${JSON.stringify(CONSENT_KEY)})}catch(e){}
gtag('consent','default',{ad_storage:c==='granted'?'granted':'denied',analytics_storage:c==='granted'?'granted':'denied',ad_user_data:c==='granted'?'granted':'denied',ad_personalization:c==='granted'?'granted':'denied',wait_for_update:500});`}
          </Script>
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${JSON.stringify(gtmId)});`}
          </Script>
        </>
      )}

      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => (window.dataLayer ??= []).push({ event: "whatsapp_click" })}
          className={`fixed bottom-5 left-5 z-40 grid size-14 place-items-center rounded-full bg-[#1f9d55] text-white shadow-[0_12px_30px_-8px_rgba(31,157,85,.6)] transition-transform hover:scale-105 ${consent === null ? "bottom-28 sm:bottom-5" : ""}`}
        >
          <Icon name="whatsapp" className="size-7" label="Chat with us on WhatsApp" />
        </a>
      )}

      {gtmId && consent === null && (
        <div role="region" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_-20px_rgba(11,22,48,.35)] sm:flex sm:items-center sm:gap-6">
          <p className="text-sm text-ink-muted">
            We use cookies to understand how our website is used and to measure our adverts. Analytics only run if you accept. See our{" "}
            <Link href="/privacy-policy/" className="text-navy-900 underline">
              privacy policy
            </Link>
            .
          </p>
          <div className="mt-4 flex shrink-0 gap-2 sm:mt-0">
            <button type="button" onClick={() => decide("denied")} className={buttonClass("outline", "sm")}>
              Decline
            </button>
            <button type="button" onClick={() => decide("granted")} className={buttonClass("primary", "sm")}>
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
