import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238 over RFC 4226): HMAC-SHA-1, 30-second steps, 6 digits.
 * Free of "server-only" so tests (including Playwright) can compute codes.
 */

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted either side of now, for clock drift. */
export const TOTP_WINDOW = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** New 160-bit secret, base32-encoded (what authenticator apps expect). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);
}

export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const bin = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totp(secret: string, nowMs = Date.now()): string {
  return hotp(secret, totpStep(nowMs));
}

/** Digits only (spaces and dashes are stripped); null when it can't be a code. */
export function normalizeTotpCode(code: string): string | null {
  const clean = code.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(clean) ? clean : null;
}

/**
 * The time step the code matches within ±TOTP_WINDOW, or null. Every candidate
 * is compared in constant time. Callers must reject steps at or below the last
 * one used (replay).
 */
export function matchTotp(secret: string, code: string, nowMs = Date.now()): number | null {
  const clean = normalizeTotpCode(code);
  if (!clean) return null;
  const now = totpStep(nowMs);
  let found: number | null = null;
  for (let step = now - TOTP_WINDOW; step <= now + TOTP_WINDOW; step++) {
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(clean)) && found === null) found = step;
  }
  return found;
}

export function otpauthUri(opts: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  // %20 rather than "+" for spaces: some authenticator apps show a literal "+".
  const q = (v: string) => encodeURIComponent(v);
  return `otpauth://totp/${label}?secret=${q(opts.secret)}&issuer=${q(opts.issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

/** "ABCD EFGH …" for typing the key in by hand. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, "$1 ");
}

// Recovery codes: lowercase letters and digits without look-alikes (0/o, 1/l/i).
const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCodes(n = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: n }, () => {
    let s = "";
    for (let i = 0; i < 8; i++) s += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

/** Canonical form for hashing: lowercase, no spaces or dashes. */
export function normalizeRecoveryCode(code: string): string | null {
  const clean = code.toLowerCase().replace(/[\s-]/g, "");
  return /^[a-z0-9]{8}$/.test(clean) ? clean : null;
}
