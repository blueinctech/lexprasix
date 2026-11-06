// Content that reproduces the live lexpraxisng.com (Ensaf theme) design:
// homepage / about / contact sections, header and footer menus, service icons
// and testimonial photos. Used by import-content.ts (fresh imports) and
// apply-live-design.ts (updating a database that was imported earlier).
// Image paths under /theme/ are files in public/theme, copied from the live site.

import type { AnyBlock } from "../src/lib/blocks";
import type { MenuItem } from "../src/db/schema";

/** Theme icon for each service, as on the live homepage cards. */
export const SERVICE_ICON_SRC: Record<string, string> = {
  "legal-service-subscription": "/theme/legal.png",
  "company-formation-and-restructuring": "/theme/balance.png",
  "access-to-foreign-markets": "/theme/roundlogo.png",
  "tax-registration-filing-and-compliance": "/theme/taxes.png",
  "intellectual-property-registration": "/theme/registration.png",
  "obtaining-business-licenses-and-permits": "/theme/driver-license.png",
  "contract-review-drafting-and-negotiation": "/theme/contract-negotiation.png",
  "vc-and-equity-funding-advisory": "/theme/advisor.png",
  "investor-due-diligence": "/theme/process-3-icon-2.svg",
  "formation-of-non-profit-organizations-charities": "/theme/charity.png",
  "real-estate-transactions": "/theme/agreement.png",
  "data-protection-and-compliance": "/theme/data-security.png",
  "data-protection-officer-dpo-services-in-nigeria": "/theme/personal-data.png",
};

/** Client photos shown with the testimonials on the live homepage. */
export const TESTIMONIAL_PHOTO: Record<string, string> = {
  "Oluebube Orji": "/theme/unnamed.png",
  "Idris Lawal": "/theme/unnamed-1.png",
  "Uwakmfon Alfred": "/theme/unnamed-2.png",
  "Ikakke Bassey": "/theme/unnamed-4.png",
  "Femi Fasae Jr.": "/theme/unnamed-5.png",
};

/** Order of the "Our Services" footer column on the live site. */
const FOOTER_SERVICE_ORDER = [
  "legal-service-subscription",
  "access-to-foreign-markets",
  "obtaining-business-licenses-and-permits",
  "company-formation-and-restructuring",
  "contract-review-drafting-and-negotiation",
  "formation-of-non-profit-organizations-charities",
  "intellectual-property-registration",
  "investor-due-diligence",
  "vc-and-equity-funding-advisory",
  "tax-registration-filing-and-compliance",
  "real-estate-transactions",
  "data-protection-and-compliance",
  "data-protection-officer-dpo-services-in-nigeria",
];

type Doc = { slug: string; title: string; group: string; sortOrder: number };
type Svc = { slug: string; title: string };

export function liveMenus(services: Svc[], docs: Doc[]): { key: string; label: string; items: MenuItem[] }[] {
  const docMenu = (group: string) =>
    docs
      .filter((d) => d.group === group)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((d) => ({ id: `doc-${d.slug}`, label: d.title, href: `/${d.slug}/` }));
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const footerServices = FOOTER_SERVICE_ORDER.filter((slug) => bySlug.has(slug)).map((slug) => ({
    id: `svc-${slug}`,
    label: bySlug.get(slug)!.title,
    href: `/service/${slug}/`,
  }));
  return [
    {
      key: "header",
      label: "Header",
      items: [
        { id: "home", label: "Home", href: "/" },
        {
          id: "documents",
          label: "Legal Documents",
          href: "/legal-forms/",
          children: [
            { id: "corporate", label: "Corporate Filings", href: "/corporate-filings/", children: docMenu("corporate-filings") },
            { id: "agreements", label: "Contracts", href: "/legal-forms/", children: docMenu("agreements") },
          ],
        },
        { id: "about", label: "About Us", href: "/about-us/" },
        { id: "services", label: "Services", href: "/service/" },
        { id: "blog", label: "Blog", href: "/blog/" },
        { id: "contact", label: "Contact", href: "/contact-us/" },
      ],
    },
    { key: "footer-services", label: "Footer: services", items: footerServices },
    {
      key: "footer-company",
      label: "Footer: pages",
      items: [
        { id: "f-blog", label: "Blog", href: "/blog/" },
        { id: "f-services", label: "Service", href: "/service/" },
        { id: "f-docs", label: "Legal Forms", href: "/legal-forms/" },
        { id: "f-about", label: "About Us", href: "/about-us/" },
        { id: "f-book", label: "Book Appointment", href: "/book-appointment/" },
      ],
    },
    {
      key: "footer-legal",
      label: "Footer: legal",
      items: [
        { id: "l-privacy", label: "Privacy Policy", href: "/privacy-policy/" },
        { id: "l-terms", label: "Terms and Condition", href: "/terms-and-condition/" },
        { id: "l-contact", label: "Contact", href: "/contact-us/" },
      ],
    },
  ];
}

/** The client logo strip shown on the homepage and services page. */
function logos(bid: () => string): AnyBlock {
  return {
    id: bid(),
    type: "logos",
    heading: "We are trusted by Clients",
    items: [
      { src: "/theme/SW-Advantage-Resources-300x300.webp", alt: "SW Advantage Resources" },
      { src: "/theme/e022dd5741502332c687d970b34b7c42.png", alt: "Gulf of Guinea Oil Exploration (GGOEX)" },
      { src: "/theme/76181bbed37adc5f173da20f54573565.jpg", alt: "Roki Foods" },
      { src: "/theme/5f545fc9d064b56ec13b4000aaa60e0c-768x432.png", alt: "Bank of Industry" },
      { src: "/theme/0c6a70d99d6ae71d4c903628e79fa385.jpg", alt: "Akamkpa Quarry Ltd." },
    ],
  };
}

/** Sections of the homepage (WP 42), About (51), Contact (50) and Services (53), keyed by WordPress id. */
export function livePageBlocks(bid: () => string): Record<number, AnyBlock[]> {
  return {
    42: [
      {
        id: bid(),
        type: "hero",
        eyebrow: "Welcome To Lex-Praxis Solicitors",
        heading: "Your Trusted Legal Partner",
        text: "",
        primary: { label: "Speak to us Now", href: "/contact-us/" },
        secondary: { label: "", href: "" },
        imageId: null,
        imageSrc: "/theme/e0.jpg",
        badgeTitle: "Join 2k+ Satisfied Clients.",
        badgeText: "4.9/5 (348+ Reviews)",
        points: [],
      },
      {
        id: bid(),
        type: "intro",
        eyebrow: "",
        heading: "Business Law Firm In Nigeria For Entrepreneurs And Corporate Organizations",
        text: "We help local and foreign entrepreneurs and businesses who are looking to start, grow or expand their businesses with the following;",
        points: ["Initial Corporate Setup", "Legal protection and compliance", "Facilitating access to foreign markets"],
        pointsHeading: "",
        points2: [],
        primary: { label: "Learn More About Us", href: "/about-us/" },
        imageSrc: "/theme/hero_1_1.jpg",
        imageSrc2: "",
        imageSrc3: "",
      },
      // Figures as shown on the live homepage; untick "verified" in the admin to hide them.
      {
        id: bid(),
        type: "stats",
        verified: true,
        items: [
          { value: "250+", label: "Businesses", iconSrc: "/theme/counter_1_1.svg" },
          { value: "10+", label: "Countries", iconSrc: "/theme/counter_1_2.svg" },
          { value: "180+", label: "Happy Clients", iconSrc: "/theme/counter_1_4.svg" },
          { value: "20+", label: "Partners", iconSrc: "/theme/counter_1_3.svg" },
        ],
      },
      {
        id: bid(),
        type: "steps",
        eyebrow: "Schedule Consultation",
        heading: "Get Started in 3 Easy Steps",
        items: [
          { title: "Book Appointment", text: "Book a Free Discovery Call to Find Out What You Qualify For", iconSrc: "/theme/process-2-icon-1.svg" },
          { title: "Get Recommendations", text: "We make recommendations on how we can help you based on your needs", iconSrc: "/theme/process-2-icon-2.svg" },
          { title: "Achieve Results", text: "We get to work on your case and ensure you have satisfactory results.", iconSrc: "/theme/process-2-icon-3.svg" },
        ],
      },
      {
        id: bid(),
        type: "cta",
        variant: "simple",
        heading: "Talk to us Now to find out how we can help you",
        text: "",
        primary: { label: "Talk to us Now", href: "/contact-us/" },
        secondary: { label: "", href: "" },
      },
      { id: bid(), type: "services", eyebrow: "Our Services", heading: "Legal Solutions for Corporate Success.", text: "", limit: 0 },
      { id: bid(), type: "reviews", heading: "What Our Clients Say", text: "" },
      { id: bid(), type: "latestPosts", eyebrow: "", heading: "Our Blog", count: 6 },
      {
        id: bid(),
        type: "split",
        heading: "Legal-Proof Your Business",
        text: "Starting or operating a business without an experienced legal team is like building a house without a solid foundation. When the storm comes pouring in or opportunities come knocking at your door, you might lose out to hefty fines, reputational damages, operational disruptions, revocation of business licenses or permits or even criminal charges, and we don’t want that for you.",
        primary: { label: "Book a FREE Discovery Call Now", href: "/book-appointment/" },
        imageSrc: "/theme/scales-justice-busine.jpg",
      },
      logos(bid),
    ],
    51: [
      {
        id: bid(),
        type: "intro",
        eyebrow: "About Us",
        heading: "Lexpraxis: Expert Legal Solutions for Businesses.",
        text: "Business Law Firm in Nigeria for Entrepreneurs and Corporate Organizations looking to START, GROW AND EXPAND YOUR BUSINESS WITH LEGAL PROTECTION. We help local and foreign entrepreneurs and businesses who are looking to start, grow or expand their businesses with the following;",
        points: [
          "Initial Corporate Setup – We assist businesses across all sectors in starting on the right footing within Nigeria to help them achieve their goals.",
          "Legal Protection & Compliance – Beyond starting up, we ensure your business is legally protected in transactions with investors, customers, regulators, and partners.",
          "Facilitating Access to Foreign Markets – We help businesses navigate legal requirements for seamless entry into international markets where we operate.",
        ],
        pointsHeading: "So that you Can:",
        points2: ["Save time focusing on what you love in your business.", "Expand your business beyond borders with confidence.", "Gain fulfillment in building the business of your dreams."],
        primary: { label: "Book a Consultation", href: "/book-appointment/" },
        imageSrc: "/theme/about-1-left.jpg",
        imageSrc2: "/theme/red-1.jpg",
        imageSrc3: "/theme/itled-1.jpg",
      },
    ],
    // Services index: the listing is generated; these sections follow it.
    53: [{ id: bid(), type: "reviews", heading: "What Our Clients Say", text: "" }, logos(bid)],
    50: [{ id: bid(), type: "contactForm", heading: "Get in Touch with Us", text: "" }],
  };
}
