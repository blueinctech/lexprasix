import { z } from "zod";

// Shapes and defaults for the editable site settings (Admin → Settings). Values
// below are the business details published on lexpraxisng.com as of the audit
// (28 Oct 2026); the firm should confirm them in the admin before launch.

const office = z.object({
  city: z.string().trim().min(1).max(60),
  address: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).default(""),
  /** Free-text query for the embedded map; defaults to the address. */
  mapQuery: z.string().trim().max(200).default(""),
});

export const settingsSchemas = {
  site: z.object({
    name: z.string().trim().min(1).max(80),
    legalName: z.string().trim().max(120).default(""),
    tagline: z.string().trim().max(200).default(""),
    email: z.email().max(120),
    phones: z.array(z.string().trim().min(3).max(40)).max(4),
    whatsapp: z.string().trim().max(40).default(""),
    offices: z.array(office).max(6),
    hours: z.string().trim().max(120).default(""),
    social: z.object({
      instagram: z.url().or(z.literal("")).default(""),
      linkedin: z.url().or(z.literal("")).default(""),
      youtube: z.url().or(z.literal("")).default(""),
      facebook: z.url().or(z.literal("")).default(""),
      x: z.url().or(z.literal("")).default(""),
    }),
    footerNote: z.string().trim().max(300).default(""),
  }),
  cta: z.object({
    headerLabel: z.string().trim().min(1).max(40),
    headerHref: z.string().trim().min(1).max(200),
    consultationTitle: z.string().trim().max(120),
    consultationText: z.string().trim().max(400),
  }),
  integrations: z.object({
    gtmId: z.string().trim().regex(/^(GTM-[A-Z0-9]+)?$/, "Use the GTM-XXXX format").default(""),
    calendlyUrl: z.url().or(z.literal("")).default(""),
    tawkPropertyId: z.string().trim().regex(/^([a-z0-9]+\/[a-z0-9]+)?$/i, "Use the property/widget format").default(""),
    tawkEnabled: z.boolean().default(false),
    whatsappEnabled: z.boolean().default(true),
    trustindexWidgetId: z.string().trim().regex(/^[a-z0-9]*$/i).default(""),
    googleSiteVerification: z.string().trim().max(100).default(""),
  }),
  seo: z.object({
    homeTitle: z.string().trim().max(120),
    titleSuffix: z.string().trim().max(60),
    defaultDescription: z.string().trim().max(300),
    defaultOgImageUrl: z.string().trim().max(500).default(""),
  }),
};

export type SettingKey = keyof typeof settingsSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingsSchemas)[K]> };

export const DEFAULT_SETTINGS: Settings = {
  site: {
    name: "LexPraxis Solicitors",
    legalName: "Lexpraxis Solicitors",
    tagline: "Business law firm in Nigeria for entrepreneurs and corporate businesses",
    email: "info@lexpraxisng.com",
    phones: ["+234 916 054 6551", "+234 706 544 3425"],
    whatsapp: "+2349160546551",
    offices: [
      { city: "Lagos", address: "23 Water Corporation Drive, Victoria Island, Lagos", phone: "", mapQuery: "" },
      { city: "Abuja", address: "22 Kumasi Crescent, Wuse 2, Abuja", phone: "", mapQuery: "" },
      { city: "Calabar", address: "66 Ndidem Usang Iso Road, Calabar", phone: "", mapQuery: "" },
    ],
    hours: "",
    social: {
      instagram: "https://www.instagram.com/lex_praxis_businesslawyers/",
      linkedin: "https://www.linkedin.com/company/lex-praxis-business-lawyers/",
      youtube: "https://www.youtube.com/@lex-praxis",
      facebook: "",
      x: "",
    },
    footerNote: "We handle the legal aspects of your business while you focus on what you love.",
  },
  cta: {
    headerLabel: "Free consultation",
    headerHref: "/book-appointment/",
    consultationTitle: "Speak with a business lawyer",
    consultationText: "Book a free discovery call. We'll listen, explain your options and recommend the next step for your business.",
  },
  integrations: {
    gtmId: "GTM-WXSMSFBP",
    calendlyUrl: "https://calendly.com/lexpraxisng-info/30min",
    tawkPropertyId: "69a7f54bd9992f1c3736409c/default",
    tawkEnabled: true,
    whatsappEnabled: true,
    trustindexWidgetId: "6e3bab8417f386200856e629116",
    googleSiteVerification: "",
  },
  seo: {
    homeTitle: "LexPraxis Solicitors - Nigerian Business Lawyers and Legal Advisor",
    titleSuffix: " - Lexpraxis Solicitors",
    defaultDescription:
      "LexPraxis Solicitors is a business law firm in Nigeria helping local and foreign entrepreneurs start, protect and expand their businesses: company formation, compliance, contracts, tax and intellectual property.",
    defaultOgImageUrl: "",
  },
};
