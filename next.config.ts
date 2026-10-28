import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tag-based caching: public pages are static and refreshed with revalidateTag on publish.
  cacheComponents: true,
  // lexpraxisng.com's indexed URLs all end in a slash; keep them identical.
  trailingSlash: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Public media bucket (set NEXT_PUBLIC_MEDIA_URL); the old host is allowed only during migration.
      ...(process.env.NEXT_PUBLIC_MEDIA_URL ? [new URL(`${process.env.NEXT_PUBLIC_MEDIA_URL.replace(/\/$/, "")}/**`)] : []),
      new URL("https://lexpraxisng.com/wp-content/uploads/**"),
    ],
  },
};

export default nextConfig;
