import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";

// Shared building blocks matching the WordPress (Ensaf) theme the site
// replicates: 1320 px content width, gold pill buttons, gold Lora sub-titles
// and large Lora section titles in deep red-brown.

export function Container({ children, className = "", size = "default" }: { children: ReactNode; className?: string; size?: "default" | "narrow" | "wide" }) {
  const max = size === "narrow" ? "max-w-3xl" : size === "wide" ? "max-w-[90rem]" : "max-w-[82.5rem]";
  return <div className={`mx-auto w-full ${max} px-4 sm:px-6 xl:px-0 ${className}`}>{children}</div>;
}

type ButtonVariant = "primary" | "gold" | "navy" | "outline" | "ghost" | "light";

const VARIANTS: Record<ButtonVariant, string> = {
  // The theme's buttons are gold pills; "primary" follows it.
  primary: "bg-gold-500 text-white hover:bg-navy-700",
  gold: "bg-gold-500 text-white hover:bg-navy-700",
  navy: "bg-navy-700 text-white hover:bg-gold-500",
  outline: "border border-navy-700/30 text-navy-700 hover:border-navy-700 hover:bg-navy-700 hover:text-white",
  ghost: "text-navy-700 hover:text-gold-500",
  light: "border border-white/40 text-white hover:border-white hover:bg-white/10",
};

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "lg" | "sm" = "md") {
  const sizes = { sm: "h-10 px-5 text-[0.85rem]", md: "h-14 px-10 text-[0.875rem]", lg: "h-14 px-10 text-[0.875rem]" };
  return `inline-flex items-center justify-center gap-2 rounded-full font-medium capitalize transition-colors duration-300 disabled:opacity-60 disabled:pointer-events-none ${sizes[size]} ${VARIANTS[variant]}`;
}

export function ButtonLink({ href, children, variant = "primary", size = "md", arrow = false, className = "", ...rest }: { href: string; children: ReactNode; variant?: ButtonVariant; size?: "md" | "lg" | "sm"; arrow?: boolean; className?: string } & Omit<ComponentProps<typeof Link>, "href">) {
  const external = /^https?:\/\//.test(href);
  const inner = (
    <>
      {children}
      {arrow && <Icon name="arrow-right" className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </>
  );
  const cls = `group ${buttonClass(variant, size)} ${className}`;
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls} {...rest}>
      {inner}
    </Link>
  );
}

/** Gold Lora sub-title shown above section titles ("Our Services", "Client Testimonials"). */
export function Eyebrow({ children, className = "", light = false }: { children: ReactNode; className?: string; light?: boolean }) {
  return <p className={`font-display text-xl font-medium ${light ? "text-gold-300" : "text-gold-500"} ${className}`}>{children}</p>;
}

export function SectionHeading({ eyebrow, heading, text, align = "left", light = false, as: Tag = "h2" }: { eyebrow?: string; heading?: string; text?: string; align?: "left" | "center"; light?: boolean; as?: "h1" | "h2" }) {
  if (!eyebrow && !heading && !text) return null;
  return (
    <div className={align === "center" ? "mx-auto max-w-5xl text-center" : "max-w-3xl"}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      {heading && <Tag className={`${eyebrow ? "mt-3" : ""} text-[2.25rem] leading-[1.18] capitalize sm:text-5xl lg:text-[3.375rem] ${light ? "text-white" : "text-heading"}`}>{heading}</Tag>}
      {text && <p className={`mt-4 ${light ? "text-white/80" : "text-ink"}`}>{text}</p>}
    </div>
  );
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  // The theme shows "October 22, 2026".
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(date));
}

