import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

// One client per server instance (and across dev hot reloads). Created lazily
// so nothing connects unless a query actually runs.
const globalForDb = globalThis as unknown as { __lpDb?: Database };

function createDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, {
    // Neon's pooler (PgBouncer, transaction mode) does not support prepared statements.
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

export function getDb(): Database {
  globalForDb.__lpDb ??= createDb();
  return globalForDb.__lpDb;
}

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

export { schema };
