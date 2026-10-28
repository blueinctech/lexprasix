// Applies SQL migrations from ./drizzle to DATABASE_URL_UNPOOLED (or DATABASE_URL).
//   npm run db:migrate
import { config } from "dotenv";
import { runMigrations } from "../src/db/client";

config({ path: process.env.ENV_FILE || ".env.local", quiet: true });
config({ quiet: true });

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
await runMigrations(url);
console.log("Migrations applied.");
