import Link from "next/link";
import { SearchBox } from "@/components/content/Archive";
import { Container, ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <section className="bg-paper-warm">
      <Container size="narrow" className="py-24 text-center sm:py-32">
        <p className="font-display text-7xl text-gold-500">404</p>
        <h1 className="mt-6 text-4xl text-navy-950 sm:text-5xl">This page could not be found</h1>
        <p className="mt-4 text-lg text-ink-muted">It may have moved when we updated our website. Try searching our articles or start from one of these pages.</p>
        <div className="mx-auto flex max-w-xl justify-center [&>form]:w-full">
          <SearchBox />
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/service/" variant="outline">Services</ButtonLink>
          <ButtonLink href="/legal-forms/" variant="outline">Legal documents</ButtonLink>
          <ButtonLink href="/contact-us/" variant="outline">Contact us</ButtonLink>
        </div>
        <p className="mt-10 text-sm text-ink-muted">
          Looking for an article? Browse <Link href="/blog/" className="text-navy-900 underline">the blog</Link>.
        </p>
      </Container>
    </section>
  );
}
