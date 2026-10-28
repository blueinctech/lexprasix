import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { authSecret } from "@/lib/env";

/** 256-bit URL-safe random token (session cookies, invite and reset links). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** SHA-256 for high-entropy secrets; only the hash is ever stored. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Keyed hash for identifiers, so a DB leak can't be reversed by brute force. */
export function hmac(purpose: string, ...parts: string[]): string {
  return createHmac("sha256", authSecret())
    .update([purpose, ...parts].join("|"))
    .digest("hex");
}

/** Pseudonymous IP fingerprint for rate limits and submission meta. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return hmac("ip", ip).slice(0, 32);
}
