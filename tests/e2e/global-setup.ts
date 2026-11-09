import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../src/db/client";
import { authors, users } from "../../src/db/schema";
import { hashPassword } from "../../src/lib/auth/password";

// Creates throwaway staff accounts with random passwords for the admin tests
// and stores them in .data/e2e-users.json (git-ignored). Runs against the same
// database as the app under test. "twofactor" is an extra editor that
// two-factor.spec.ts turns 2FA on and off for; every run starts with 2FA off.
export default async function globalSetup() {
  config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
  const { db, close } = await createDatabase(process.env.DATABASE_URL!, { max: 1 });
  const [author] = await db.select({ id: authors.id }).from(authors).limit(1);
  const accounts: Record<string, { email: string; password: string }> = {};
  const seeds = [
    ["administrator", "administrator"],
    ["editor", "editor"],
    ["author", "author"],
    ["twofactor", "editor"],
  ] as const;
  for (const [key, role] of seeds) {
    const email = `e2e-${key}@test.lexpraxis.local`;
    const password = randomBytes(18).toString("base64url");
    const noTwoFactor = { totpSecret: null, totpPendingSecret: null, totpEnabledAt: null, totpLastStep: null, recoveryCodes: [] };
    const values = { email, name: `E2E ${key}`, role, isActive: true, passwordHash: await hashPassword(password), failedLoginAttempts: 0, lockedUntil: null, authorId: role === "author" ? (author?.id ?? null) : null, ...noTwoFactor };
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) await db.update(users).set(values).where(eq(users.id, existing.id));
    else await db.insert(users).values(values);
    accounts[key] = { email, password };
  }
  await mkdir(".data", { recursive: true });
  await writeFile(".data/e2e-users.json", JSON.stringify(accounts));
  await close();
}
