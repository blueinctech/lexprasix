// Runs a real PostgreSQL server for local development (data in .data/postgres).
// Same engine and driver as production (Neon), no install needed.
//   npm run db:local     (leave running; then npm run db:migrate / migrate:content / dev)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.data/postgres";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 54329, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });

if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("lexpraxis");
} catch {
  /* already exists */
}
console.log("Local Postgres ready: postgres://postgres:postgres@127.0.0.1:54329/lexpraxis");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
