import type { Metadata } from "next";
import NotFound from "../not-found";

// Static copy of the 404 page. src/proxy.ts serves this HTML with a real 404
// status for content URLs that don't exist (a streamed page can't change its
// status once sent). Never indexed, never in the sitemap.
export const metadata: Metadata = { title: { absolute: "Page not found - Lexpraxis Solicitors" }, robots: { index: false, follow: false } };

export default function PageNotFound() {
  return <NotFound />;
}
