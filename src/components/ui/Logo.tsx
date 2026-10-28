// The LexPraxis shield-and-quill mark, redrawn as SVG from the firm's logo, with the wordmark.

export function LogoMark({ className = "h-10 w-auto", inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden="true" focusable="false">
      <path d="M32 3 6 11v22c0 17.5 11.2 30.4 26 36 14.8-5.6 26-18.5 26-36V11L32 3Z" fill={inverted ? "#ffffff" : "#20336d"} stroke="#9aa0ab" strokeWidth="2.5" />
      <path d="M32 9.5 12 15.6v17.2c0 13.6 8.4 23.8 20 28.6 11.6-4.8 20-15 20-28.6V15.6L32 9.5Z" fill="none" stroke={inverted ? "#20336d" : "#ffffff"} strokeOpacity=".22" strokeWidth="1" />
      <path d="M58 6C46 9 36 17 29 28c-4.5 7-7.8 15-10 23l2 1c2.6-7 6-14 10.4-20.2C38 22.4 46.5 14 58 6Z" fill="#b8bcc4" />
      <path d="M58 6c-6 6.5-12.6 13-18 20.5-2.4 3.3-4.6 6.9-6.5 10.6" fill="none" stroke="#8a8f99" strokeWidth=".9" />
      <text x="31" y="50" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="17" fontWeight="600" fill={inverted ? "#20336d" : "#ffffff"} letterSpacing=".5">
        LP
      </text>
    </svg>
  );
}

export function Logo({ inverted = false, className = "" }: { inverted?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className="h-11 w-auto shrink-0" inverted={false} />
      <span className="flex flex-col leading-none">
        <span className={`font-display text-[1.45rem] font-medium tracking-tight ${inverted ? "text-white" : "text-navy-900"}`}>LexPraxis</span>
        <span className={`mt-1 text-[0.62rem] font-semibold tracking-[0.32em] uppercase ${inverted ? "text-gold-300" : "text-gold-700"}`}>Solicitors</span>
      </span>
    </span>
  );
}
