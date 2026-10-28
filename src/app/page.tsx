// Phase B foundation only. The real homepage (CMS-driven) replaces this in Phase C;
// non-production deployments are noindex, so this never reaches search engines.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6">
      <p className="text-sm font-medium tracking-[0.2em] text-gold-700 uppercase">LexPraxis Solicitors</p>
      <h1 className="text-4xl text-navy-900 sm:text-5xl">New website in development</h1>
      <p className="text-ink-muted">
        The live site remains at lexpraxisng.com while this rebuild is completed. See <code>docs/</code> for the audit and migration plan.
      </p>
    </main>
  );
}
