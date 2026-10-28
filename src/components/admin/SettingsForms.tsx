"use client";

import { useState } from "react";
import { saveSettings } from "@/app/admin/_actions/settings";
import type { Settings } from "@/lib/settings-schema";
import { ActionForm, btn, Checkbox, SubmitButton, TextArea, TextInput } from "./ui";

type Office = Settings["site"]["offices"][number];

function OfficesEditor({ initial }: { initial: Office[] }) {
  const [offices, setOffices] = useState<Office[]>(initial);
  const set = (i: number, patch: Partial<Office>) => setOffices((o) => o.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium text-slate-800">Offices</legend>
      <input type="hidden" name="offices" value={JSON.stringify(offices)} />
      {offices.map((o, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[10rem_1fr_12rem_auto]">
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            City
            <input value={o.city} onChange={(e) => set(i, { city: e.target.value })} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Address
            <input value={o.address} onChange={(e) => set(i, { address: e.target.value })} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600">
            Phone (optional)
            <input value={o.phone} onChange={(e) => set(i, { phone: e.target.value })} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
          </label>
          <div className="flex items-end gap-1">
            <button type="button" className={btn("ghost", true)} disabled={i === 0} onClick={() => setOffices((list) => { const c = [...list]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; })}>
              Up
            </button>
            <button type="button" className={btn("ghost", true)} onClick={() => setOffices((list) => list.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
          <label className="grid gap-1 text-xs font-medium text-slate-600 md:col-span-4">
            Map search text (optional — defaults to the address)
            <input value={o.mapQuery} onChange={(e) => set(i, { mapQuery: e.target.value })} className="h-9 rounded-md border border-slate-300 px-2 text-sm" />
          </label>
        </div>
      ))}
      {offices.length < 6 && (
        <div>
          <button type="button" className={btn("secondary", true)} onClick={() => setOffices((o) => [...o, { city: "", address: "", phone: "", mapQuery: "" }])}>
            Add office
          </button>
        </div>
      )}
    </fieldset>
  );
}

export function SiteSettingsForm({ value }: { value: Settings["site"] }) {
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="key" value="site" />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Firm name" name="name" defaultValue={value.name} required maxLength={80} />
        <TextInput label="Legal name" name="legalName" defaultValue={value.legalName} maxLength={120} hint="Shown in the copyright line." />
        <TextInput label="Tagline" name="tagline" defaultValue={value.tagline} maxLength={200} className="md:col-span-2" />
        <TextInput label="Email" name="email" type="email" defaultValue={value.email} required />
        <TextInput label="WhatsApp number" name="whatsapp" defaultValue={value.whatsapp} hint="International format, e.g. +2349160546551. Used for the floating chat button." />
        <TextArea label="Phone numbers" name="phones" defaultValue={value.phones.join("\n")} rows={2} hint="One per line. The first is shown in the header." />
        <TextInput label="Opening hours" name="hours" defaultValue={value.hours} maxLength={120} placeholder="Mon–Fri, 9am–5pm" />
      </div>
      <OfficesEditor initial={value.offices} />
      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-1 text-sm font-medium text-slate-800">Social profiles (full URLs, leave empty to hide)</legend>
        <TextInput label="LinkedIn" name="social.linkedin" type="url" defaultValue={value.social.linkedin} />
        <TextInput label="Instagram" name="social.instagram" type="url" defaultValue={value.social.instagram} />
        <TextInput label="YouTube" name="social.youtube" type="url" defaultValue={value.social.youtube} />
        <TextInput label="Facebook" name="social.facebook" type="url" defaultValue={value.social.facebook} />
        <TextInput label="X (Twitter)" name="social.x" type="url" defaultValue={value.social.x} />
      </fieldset>
      <TextArea label="Footer quote" name="footerNote" defaultValue={value.footerNote} rows={2} maxLength={300} />
      <div>
        <SubmitButton>Save business details</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CtaSettingsForm({ value }: { value: Settings["cta"] }) {
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="key" value="cta" />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Header button label" name="headerLabel" defaultValue={value.headerLabel} required maxLength={40} />
        <TextInput label="Header button link" name="headerHref" defaultValue={value.headerHref} required maxLength={200} hint="E.g. /book-appointment/" />
        <TextInput label="Consultation call-to-action title" name="consultationTitle" defaultValue={value.consultationTitle} maxLength={120} className="md:col-span-2" />
        <TextArea label="Consultation call-to-action text" name="consultationText" defaultValue={value.consultationText} maxLength={400} className="md:col-span-2" hint="Shown at the end of service pages and the services list." />
      </div>
      <div>
        <SubmitButton>Save calls to action</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function IntegrationsSettingsForm({ value }: { value: Settings["integrations"] }) {
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="key" value="integrations" />
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Google Tag Manager container ID" name="gtmId" defaultValue={value.gtmId} placeholder="GTM-XXXXXXX" hint="Loads GA4, Google Ads and other tags configured in GTM. Analytics only run after a visitor accepts cookies. Leave empty to turn tracking off." />
        <TextInput label="Calendly booking link" name="calendlyUrl" type="url" defaultValue={value.calendlyUrl} hint="The event page embedded on Book Appointment, e.g. https://calendly.com/lexpraxisng-info/30min." />
        <TextInput label="Tawk.to property / widget" name="tawkPropertyId" defaultValue={value.tawkPropertyId} placeholder="property-id/widget-id" hint="From Tawk.to → Administration → Chat Widget (the part after embed.tawk.to/)." />
        <TextInput label="Trustindex widget ID" name="trustindexWidgetId" defaultValue={value.trustindexWidgetId} hint="Shows Google reviews on request on the Reviews section. Leave empty to show only testimonials." />
        <TextInput label="Google site verification code" name="googleSiteVerification" defaultValue={value.googleSiteVerification} hint="Only if Search Console asks for an HTML meta tag (DNS verification is preferred)." />
      </div>
      <div className="grid gap-3">
        <Checkbox name="tawkEnabled" label="Show Tawk.to live chat" defaultChecked={value.tawkEnabled} hint="Loads after the visitor first interacts with the page." />
        <Checkbox name="whatsappEnabled" label="Show the WhatsApp chat button" defaultChecked={value.whatsappEnabled} hint="Uses the WhatsApp number from business details." />
      </div>
      <div>
        <SubmitButton>Save integrations</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SeoSettingsForm({ value }: { value: Settings["seo"] }) {
  return (
    <ActionForm action={saveSettings}>
      <input type="hidden" name="key" value="seo" />
      <div className="grid gap-4">
        <TextInput label="Homepage title" name="homeTitle" defaultValue={value.homeTitle} maxLength={120} hint="The browser tab and Google title for the homepage." />
        <TextInput label="Title suffix" name="titleSuffix" defaultValue={value.titleSuffix} maxLength={60} hint="Added after every page title unless the page sets its own SEO title. Matches the old site: “ - Lexpraxis Solicitors”." />
        <TextArea label="Default meta description" name="defaultDescription" defaultValue={value.defaultDescription} maxLength={300} hint="Used when a page has no description of its own. Aim for 120–160 characters." />
        <TextInput label="Default social sharing image URL" name="defaultOgImageUrl" defaultValue={value.defaultOgImageUrl} maxLength={500} hint="Copy a URL from the media library. Ideal size 1200×630." />
      </div>
      <div>
        <SubmitButton>Save SEO defaults</SubmitButton>
      </div>
    </ActionForm>
  );
}
