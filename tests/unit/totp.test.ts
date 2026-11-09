import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateRecoveryCodes, generateTotpSecret, groupSecret, matchTotp, normalizeRecoveryCode, otpauthUri, totp, totpStep } from "@/lib/auth/totp";

// RFC 6238 appendix B (SHA-1 seed "12345678901234567890"), last 6 of the 8 digits.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totp(RFC_SECRET, 59_000)).toBe("287082");
    expect(totp(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totp(RFC_SECRET, 1_234_567_890_000)).toBe("005924");
    expect(totp(RFC_SECRET, 2_000_000_000_000)).toBe("279037");
  });

  it("round-trips base32 and makes 160-bit secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(base32Decode(groupSecret(secret).toLowerCase())).toEqual(base32Decode(secret));
  });

  it("accepts the previous and next step only, and ignores spaces", () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = totpStep(now);
    expect(matchTotp(secret, totp(secret, now), now)).toBe(step);
    expect(matchTotp(secret, totp(secret, now - 30_000), now)).toBe(step - 1);
    expect(matchTotp(secret, totp(secret, now + 30_000), now)).toBe(step + 1);
    expect(matchTotp(secret, totp(secret, now - 60_000), now)).toBeNull();
    expect(matchTotp(secret, totp(secret, now + 60_000), now)).toBeNull();
    const code = totp(secret, now);
    expect(matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, now)).toBe(step);
    expect(matchTotp(secret, "abcdef", now)).toBeNull();
  });

  it("builds the otpauth URI", () => {
    const uri = otpauthUri({ secret: "ABCD", account: "a@b.com", issuer: "LexPraxis Admin" });
    expect(uri).toBe("otpauth://totp/LexPraxis%20Admin%3Aa%40b.com?secret=ABCD&issuer=LexPraxis%20Admin&algorithm=SHA1&digits=6&period=30");
  });

  it("recovery codes are 10 × xxxx-xxxx without look-alike characters", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/);
    expect(normalizeRecoveryCode(" ABCD-EFGH ")).toBe("abcdefgh");
    expect(normalizeRecoveryCode("abc")).toBeNull();
  });
});
