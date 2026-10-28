// Integration tests run against a separate database on the local Postgres
// (npm run db:local). Override with TEST_DATABASE_URL.
import postgres from "postgres";
import { runMigrations } from "@/db/client";

export const TEST_DB_URL = process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:54329/lexpraxis_test";

export async function prepareTestDatabase() {
  const url = new URL(TEST_DB_URL);
  const name = url.pathname.slice(1);
  url.pathname = "/postgres";
  const admin = postgres(url.toString(), { max: 1 });
  const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
  if (!exists) await admin.unsafe(`create database "${name.replace(/"/g, "")}"`);
  await admin.end();
  await runMigrations(TEST_DB_URL);
  process.env.DATABASE_URL = TEST_DB_URL;
}
