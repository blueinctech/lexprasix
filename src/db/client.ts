import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Shared by the app (src/db/index.ts) and scripts. Production uses Neon through
// postgres-js. For local development and tests, DATABASE_URL may be
// "pglite:<dir>" (Postgres compiled to WebAssembly, persisted in a folder), so
// the project runs without a database server. Both expose the same query API.

export type Database = PostgresJsDatabase<typeof schema>;

export function isPglite(url: string) {
  return url.startsWith("pglite:");
}

export async function createDatabase(url: string, opts: { max?: number } = {}): Promise<{ db: Database; close: () => Promise<void> }> {
  if (isPglite(url)) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const dir = url.slice("pglite:".length) || "./.data/pglite";
    if (dir !== "memory://") (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    // The PGlite and postgres-js drivers share Drizzle's Postgres query builder.
    return { db: drizzle({ client, schema }) as unknown as Database, close: () => client.close() };
  }
  const client = postgres(url, {
    // Neon's pooler (PgBouncer, transaction mode) does not support prepared statements.
    prepare: false,
    max: opts.max ?? 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return { db: drizzlePostgres(client, { schema }), close: () => client.end() };
}

/** Applies the SQL migrations in ./drizzle. */
export async function runMigrations(url: string): Promise<void> {
  const migrationsFolder = "./drizzle";
  if (isPglite(url)) {
    const { db, close } = await createDatabase(url);
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
    await close();
    return;
  }
  const client = postgres(url, { max: 1 });
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(drizzlePostgres(client), { migrationsFolder });
  await client.end();
}
