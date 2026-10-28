import type { NextConfig } from "next";

const mediaUrl = (process.env.NEXT_PUBLIC_MEDIA_URL || "").replace(/\/$/, "");

// Third parties the public site legitimately loads (see docs/WORDPRESS_PLUGIN_AUDIT.md).
const CSP = [
  "default-src 'self'",
  // Next.js inline bootstrap + GTM/GA/Ads, Tawk.to, Trustindex. Nonces would force every page dynamic.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://embed.tawk.to https://*.tawk.to https://cdn.jsdelivr.net https://cdn.trustindex.io`,
  "style-src 'self' 'unsafe-inline' https://embed.tawk.to https://*.tawk.to https://fonts.googleapis.com https://cdn.trustindex.io",
  `img-src 'self' data: blob: https:`,
  "font-src 'self' data: https://*.tawk.to https://fonts.gstatic.com https://cdn.trustindex.io",
  `connect-src 'self' https: wss://*.tawk.to${process.env.NODE_ENV === "development" ? " ws: http://localhost:*" : ""}`,
  "frame-src https://calendly.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com https://maps.google.com https://*.tawk.to https://td.doubleclick.net https://www.googletagmanager.com",
  "media-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self'`,
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Tag-based caching: public pages are static and refreshed with updateTag on publish.
  cacheComponents: true,
  partialPrefetching: true,
  // lexpraxisng.com's indexed URLs all end in a slash; keep them identical.
  trailingSlash: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      ...(mediaUrl.startsWith("http") ? [new URL(`${mediaUrl}/**`)] : []),
      // Old host, used only until media is migrated to the bucket.
      new URL("https://lexpraxisng.com/wp-content/uploads/**"),
    ],
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/brand/**" }],
  },
  experimental: {
    // Uploads go straight to storage; actions carry form answers and long article HTML.
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    const security = [
      { key: "Content-Security-Policy", value: CSP },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
    ];
    return [
      { source: "/:path*", headers: security },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  async redirects() {
    return [
      // Date archives were thin listing pages, not in the sitemap.
      { source: "/:year(\\d{4})/:month(\\d{2})/:day(\\d{2})", destination: "/blog/", permanent: true },
      { source: "/:year(\\d{4})/:month(\\d{2})", destination: "/blog/", permanent: true },
      // Yoast and core WordPress sitemaps.
      { source: "/sitemap_index.xml", destination: "/sitemap.xml", permanent: true },
      { source: "/:type([a-z_]+)-sitemap:n(\\d*).xml", destination: "/sitemap.xml", permanent: true },
      { source: "/wp-sitemap.xml", destination: "/sitemap.xml", permanent: true },
      // Feeds.
      { source: "/:kind(category|tag|author)/:slug/feed", destination: "/feed/", permanent: true },
      { source: "/comments/feed", destination: "/feed/", permanent: true },
      { source: "/:slug/feed", destination: "/:slug/", permanent: true },
      // Staff bookmarks.
      { source: "/wp-admin/:path*", destination: "/admin/login/", permanent: false },
      { source: "/wp-login.php", destination: "/admin/login/", permanent: false },
      // Media keeps its WordPress paths on the new storage.
      {
        source: "/wp-content/uploads/:path*",
        destination: `${mediaUrl && mediaUrl !== "/media" ? mediaUrl : "/media"}/wp-content/uploads/:path*`,
        permanent: mediaUrl.startsWith("http"),
      },
    ];
  },
};

export default nextConfig;
