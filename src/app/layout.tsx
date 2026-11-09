import type { Metadata } from "next";
import { Inter, Kotta_One, Lora } from "next/font/google";
import "./globals.css";

// Same typefaces as the WordPress theme: Lora headings, Inter text, Kotta One for the footer quote.
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap", weight: ["400", "500", "600", "700"] });
const kotta = Kotta_One({ subsets: ["latin"], variable: "--font-kotta", display: "swap", weight: "400" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lexpraxisng.com";
const isProduction = process.env.SITE_ENV === "production" || process.env.VERCEL_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LexPraxis Solicitors - Nigerian Business Lawyers and Legal Advisor", template: "%s - Lexpraxis Solicitors" },
  // Only the production deployment may be indexed.
  robots: isProduction ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${lora.variable} ${inter.variable} ${kotta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
