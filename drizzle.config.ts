import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

// `generate` needs no database; `migrate` and `studio` use the direct (unpooled) Neon connection.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "postgres://localhost/unset";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
