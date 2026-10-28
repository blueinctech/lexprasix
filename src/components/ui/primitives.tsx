import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./Icon";

export function Container({ children, className = "", size = "default" }: { children: ReactNode; className?: string; size?: "default" | "narrow" | "wide" }) {
  const max = size === "narrow" ? "max-w-3xl" : size === "wide" ? "max-w-[88rem]" : "max-w-7xl";
  return <div className={`mx-auto w-full ${max} px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

type ButtonVariant = "primary" | "gold" | "outline" | "ghost" | "light";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-navy-900 text-white hover:bg-navy-700 shadow-[0_1px_0_rgba(255,255,255,.08)_inset]",
  gold: "bg-gold-500 text-navy-950 hover:bg-gold-300",
  outline: "border border-navy-900/20 text-navy-900 hover:border-navy-900 hover:bg-navy-900/[.03]",
  ghost: "text-navy-900 hover:text-gold-700",
  light: "border border-white/25 text-white hover:border-white hover:bg-white/5",
};

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "lg" | "sm" = "md") {
  const sizes = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[0.95rem]", lg: "h-13 px-7 text-base" };
  return `inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 disabled:opacity-60 disabled:pointer-events-none ${sizes[size]} ${VARIANTS[variant]}`;
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

export function Eyebrow({ children, className = "", light = false }: { children: ReactNode; className?: string; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[0.72rem] font-semibold tracking-[0.24em] uppercase ${light ? "text-gold-300" : "text-gold-700"} ${className}`}>
      <span className={`h-px w-8 ${light ? "bg-gold-300/60" : "bg-gold-500/70"}`} aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, heading, text, align = "left", light = false, as: Tag = "h2" }: { eyebrow?: string; heading?: string; text?: string; align?: "left" | "center"; light?: boolean; as?: "h1" | "h2" }) {
  if (!eyebrow && !heading && !text) return null;
  return (
    <div className={`max-w-2xl ${align === "center" ? "mx-auto text-center [&>p:first-child]:justify-center" : ""}`}>
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      {heading && <Tag className={`mt-4 text-3xl sm:text-4xl lg:text-[2.75rem] ${light ? "text-white" : "text-navy-950"}`}>{heading}</Tag>}
      {text && <p className={`mt-4 text-lg leading-relaxed ${light ? "text-white/75" : "text-ink-muted"}`}>{text}</p>}
    </div>
  );
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(date));
}
