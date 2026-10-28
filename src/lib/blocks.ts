import { z } from "zod";

// Page-builder blocks for CMS pages. Each block has a typed shape validated on
// save; src/components/blocks renders them. Rich text is sanitised HTML.

const id = z.string().min(1).max(40);
const EMBED_HOSTS = ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "www.google.com", "maps.google.com"];
const link = z.object({ label: z.string().trim().max(60).default(""), href: z.string().trim().max(300).default("") });

export const blockSchemas = {
  hero: z.object({
    id,
    type: z.literal("hero"),
    eyebrow: z.string().trim().max(80).default(""),
    heading: z.string().trim().min(1).max(160),
    text: z.string().trim().max(600).default(""),
    primary: link,
    secondary: link,
    imageId: z.string().uuid().nullable().default(null),
    points: z.array(z.string().trim().max(120)).max(6).default([]),
  }),
  richText: z.object({ id, type: z.literal("richText"), heading: z.string().trim().max(160).default(""), html: z.string().max(200_000) }),
  services: z.object({
    id,
    type: z.literal("services"),
    eyebrow: z.string().trim().max(80).default(""),
    heading: z.string().trim().max(160).default(""),
    text: z.string().trim().max(400).default(""),
    /** Empty = all published services in display order. */
    limit: z.number().int().min(0).max(30).default(0),
  }),
  steps: z.object({
    id,
    type: z.literal("steps"),
    eyebrow: z.string().trim().max(80).default(""),
    heading: z.string().trim().max(160).default(""),
    items: z.array(z.object({ title: z.string().trim().min(1).max(100), text: z.string().trim().max(400) })).max(6),
  }),
  features: z.object({
    id,
    type: z.literal("features"),
    eyebrow: z.string().trim().max(80).default(""),
    heading: z.string().trim().max(160).default(""),
    text: z.string().trim().max(400).default(""),
    items: z.array(z.object({ title: z.string().trim().min(1).max(100), text: z.string().trim().max(400) })).max(9),
  }),
  stats: z.object({
    id,
    type: z.literal("stats"),
    /** Only verified figures. The block renders nothing while `verified` is false. */
    verified: z.boolean().default(false),
    items: z.array(z.object({ value: z.string().trim().min(1).max(20), label: z.string().trim().min(1).max(60) })).max(6),
  }),
  documents: z.object({ id, type: z.literal("documents"), eyebrow: z.string().trim().max(80).default(""), heading: z.string().trim().max(160).default(""), text: z.string().trim().max(400).default(""), group: z.enum(["all", "corporate-filings", "agreements"]).default("all") }),
  latestPosts: z.object({ id, type: z.literal("latestPosts"), eyebrow: z.string().trim().max(80).default(""), heading: z.string().trim().max(160).default(""), count: z.number().int().min(1).max(12).default(3) }),
  faq: z.object({ id, type: z.literal("faq"), heading: z.string().trim().max(160).default(""), items: z.array(z.object({ question: z.string().trim().min(1).max(200), answer: z.string().trim().min(1).max(3000) })).max(30) }),
  cta: z.object({ id, type: z.literal("cta"), heading: z.string().trim().min(1).max(160), text: z.string().trim().max(400).default(""), primary: link, secondary: link }),
  quote: z.object({ id, type: z.literal("quote"), text: z.string().trim().min(1).max(600), attribution: z.string().trim().max(120).default("") }),
  offices: z.object({ id, type: z.literal("offices"), heading: z.string().trim().max(160).default(""), showMap: z.boolean().default(true) }),
  contactForm: z.object({ id, type: z.literal("contactForm"), heading: z.string().trim().max(160).default(""), text: z.string().trim().max(400).default("") }),
  calendly: z.object({ id, type: z.literal("calendly"), heading: z.string().trim().max(160).default(""), text: z.string().trim().max(400).default("") }),
  reviews: z.object({ id, type: z.literal("reviews"), heading: z.string().trim().max(160).default(""), text: z.string().trim().max(400).default("") }),
  embed: z.object({
    id,
    type: z.literal("embed"),
    title: z.string().trim().min(1).max(120),
    // https only, from known embed providers (also enforced by the CSP frame-src).
    url: z.url({ protocol: /^https$/ }).refine((u) => EMBED_HOSTS.includes(new URL(u).hostname), { error: "Use a YouTube, Vimeo or Google Maps embed link" }),
  }),
};

export type BlockType = keyof typeof blockSchemas;
export const blockSchema = z.discriminatedUnion("type", Object.values(blockSchemas) as unknown as [z.ZodObject<{ type: z.ZodLiteral<string> }>, ...z.ZodObject<{ type: z.ZodLiteral<string> }>[]]);
export type BlockOf<T extends BlockType> = z.infer<(typeof blockSchemas)[T]>;
export type AnyBlock = { [K in BlockType]: BlockOf<K> }[BlockType];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  richText: "Text",
  services: "Services grid",
  steps: "Process steps",
  features: "Feature list",
  stats: "Figures (verified only)",
  documents: "Legal documents grid",
  latestPosts: "Latest articles",
  faq: "FAQs",
  cta: "Call to action",
  quote: "Quote",
  offices: "Offices",
  contactForm: "Contact form",
  calendly: "Booking calendar",
  reviews: "Reviews",
  embed: "Embed (YouTube/Maps)",
};

export function parseBlocks(input: unknown): AnyBlock[] {
  return z.array(blockSchema).parse(input) as AnyBlock[];
}
