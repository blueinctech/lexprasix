import "server-only";
import { headers } from "next/headers";
import { hashIp } from "./crypto";

export type RequestContext = {
  ip: string | null;
  ipHash: string | null;
  userAgent: string | null;
  /** Path of the page the request came from (no query string), when known. */
  refererPath: string | null;
};

/** Client IP, user agent and referring path for the current request (Vercel sets x-forwarded-for). */
export async function getRequestContext(): Promise<RequestContext> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 400) ?? null;
  let refererPath: string | null = null;
  try {
    const referer = h.get("referer");
    if (referer) refererPath = new URL(referer).pathname.slice(0, 300);
  } catch {
    refererPath = null;
  }
  return { ip, ipHash: hashIp(ip), userAgent, refererPath };
}

/** Only allow same-site relative paths (prevents open redirects). */
export function safeRedirectPath(path: string | null | undefined, fallback: string): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path;
}
