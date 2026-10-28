// Creates (or re-invites) an administrator from the command line. Prints a
// one-time link to set the password; nothing secret is stored or logged.
//   npm run admin:create -- --email you@lexpraxisng.com --name "Your Name"
import { randomBytes, createHash } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { authTokens, users } from "../src/db/schema";

config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
config({ quiet: true });

const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => { const [k, ...v] = a.trim().split(" "); return [k, v.join(" ").replace(/^"|"$/g, "")]; }));
const email = String(args.email ?? "").toLowerCase().trim();
const name = String(args.name ?? "").trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Usage: npm run admin:create -- --email you@example.com --name "Full Name"');
  process.exit(1);
}
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, close } = await createDatabase(url, { max: 1 });

const [existing] = await db.select().from(users).where(eq(users.email, email));
const user = existing
  ? (await db.update(users).set({ role: "administrator", isActive: true, name }).where(eq(users.id, existing.id)).returning())[0]
  : (await db.insert(users).values({ email, name, role: "administrator" }).returning())[0];

const token = randomBytes(32).toString("base64url");
await db.insert(authTokens).values({ userId: user.id, purpose: "invite", tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 7 * 86_400_000) });
const base = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
console.log(`${existing ? "Updated" : "Created"} administrator ${email}.`);
console.log(`Open this link within 7 days to set the password (works once):\n${base}/admin/accept-invite/?token=${token}`);
await close();
