"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { submitFormAction } from "@/app/actions/forms";
import { Icon } from "@/components/ui/Icon";

const CONSENT = "I agree to receive occasional emails from LexPraxis Solicitors and can unsubscribe at any time. See our privacy policy.";

// Footer newsletter sign-up. Replaces the old theme form, which had no action
// and silently discarded every address. Sign-ups are stored for export.
export function NewsletterForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const key = useRef("");
  const startedAt = useRef(0);
  const [hp, setHp] = useState("");

  useEffect(() => {
    key.current = crypto.randomUUID();
    startedAt.current = Date.now();
  }, []);

  return (
    <form
      className="mt-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!consent) return setMessage({ ok: false, text: "Please agree to receive emails from us." });
        start(async () => {
          const res = await submitFormAction({ formId: "newsletter", values: { email }, website: hp, elapsedMs: Date.now() - startedAt.current, idempotencyKey: key.current, pagePath: location.pathname, consent: { text: CONSENT } }).catch(() => null);
          if (res?.status === "success") {
            setMessage({ ok: true, text: res.message });
            (window.dataLayer ??= []).push({ event: "newsletter_signup" });
          } else setMessage({ ok: false, text: res?.status === "invalid" ? (res.errors.email ?? res.message) : (res?.message ?? "Something went wrong. Please try again.") });
        });
      }}
    >
      {message?.ok ? (
        <p role="status" className="flex items-center gap-2 text-sm text-gold-300">
          <Icon name="check" className="size-4" /> {message.text}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <label htmlFor={`${id}-email`} className="sr-only">
              Email address
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 focus:border-gold-300 focus:outline-none"
            />
            <button type="submit" disabled={pending} className="h-11 shrink-0 rounded-full bg-gold-500 px-5 text-sm font-medium text-navy-950 hover:bg-gold-300 disabled:opacity-60">
              {pending ? "…" : "Subscribe"}
            </button>
          </div>
          <input className="absolute -left-[9999px]" tabIndex={-1} aria-hidden="true" autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
          <label className="mt-3 flex items-start gap-2 text-xs text-white/60">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-gold-500" />
            {CONSENT}
          </label>
          {message && (
            <p role="alert" className="mt-2 text-xs text-red-300">
              {message.text}
            </p>
          )}
        </>
      )}
    </form>
  );
}
