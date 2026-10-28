import "server-only";
import { createDatabase, type Database } from "./client";
import * as schema from "./schema";

export type { Database };
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

// One client per server instance (and across dev hot reloads), created on first use.
const globalForDb = globalThis as unknown as { __lpDb?: Promise<Database> };

export function getDb(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalForDb.__lpDb ??= createDatabase(url, { max: process.env.NODE_ENV === "production" ? 5 : 3 }).then((r) => r.db);
  return globalForDb.__lpDb;
}

export { schema };
