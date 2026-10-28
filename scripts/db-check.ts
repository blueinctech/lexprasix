// Dev helper: shows the latest submissions and outbox emails.
import { config } from "dotenv";
import { desc } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import * as s from "../src/db/schema";
config({ path: ".env.local", quiet: true });
const { db, close } = await createDatabase(process.env.DATABASE_URL!);
console.log(await db.select({ ref: s.submissions.reference, form: s.submissions.formId, status: s.submissions.status, name: s.submissions.name, email: s.submissions.email }).from(s.submissions).orderBy(desc(s.submissions.createdAt)).limit(3));
console.log(await db.select({ template: s.emailOutbox.template, to: s.emailOutbox.to, status: s.emailOutbox.status, attempts: s.emailOutbox.attempts, id: s.emailOutbox.providerMessageId, err: s.emailOutbox.lastError }).from(s.emailOutbox).orderBy(desc(s.emailOutbox.createdAt)).limit(4));
await close();
