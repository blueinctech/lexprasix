// Typed access to environment variables. Server-only values are read lazily so
// a missing variable fails the request that needs it, with a clear message,
// instead of breaking the whole build.

export class ConfigurationError extends Error {
  constructor(variable: string, purpose: string) {
    super(`${purpose} is not configured (${variable} is missing).`);
    this.name = "ConfigurationError";
  }
}

export const isProductionSite = process.env.SITE_ENV === "production";
export const isDev = process.env.NODE_ENV !== "production";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://lexpraxisng.com").replace(/\/$/, "");
}

/** Base URL for links in emails (the deployment being used, not always production). */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (isDev) return `http://localhost:${process.env.PORT ?? 3000}`;
  return siteUrl();
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isDev) return "development-only-secret-do-not-use-in-production!!";
  throw new ConfigurationError("AUTH_SECRET", "Authentication");
}

/** Public base URL for media files, without trailing slash. Local dev serves them from /media. */
export function mediaBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_URL || "/media").replace(/\/$/, "");
}

export function uploadMaxBytes(): number {
  return Number(process.env.UPLOAD_MAX_MB || 10) * 1024 * 1024;
}

export function staffRecipients(): string[] {
  return (process.env.EMAIL_STAFF_TO || "info@lexpraxisng.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
