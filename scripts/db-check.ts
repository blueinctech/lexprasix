// Dev helper: lists staff accounts and recent audit entries.
import { config } from "dotenv";
import { desc } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import * as s from "../src/db/schema";
config({ path: ".env.local", quiet: true });
const { db, close } = await createDatabase(process.env.DATABASE_URL!);
console.log(await db.select({ email: s.users.email, role: s.users.role, active: s.users.isActive }).from(s.users));
console.log(await db.select({ action: s.auditLog.action, at: s.auditLog.createdAt }).from(s.auditLog).orderBy(desc(s.auditLog.createdAt)).limit(5));
await close();
