import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lexpraxisng.com";
const isProduction = process.env.SITE_ENV === "production";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LexPraxis Solicitors - Nigerian Business Lawyers and Legal Advisor", template: "%s - Lexpraxis Solicitors" },
  // Only the production deployment may be indexed.
  robots: isProduction ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
