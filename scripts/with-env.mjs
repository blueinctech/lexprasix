// Runs a command with ENV_FILE pointing at another env file (works in
// PowerShell, cmd and bash).  node scripts/with-env.mjs .env.prod.local tsx scripts/migrate.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const [file, cmd, ...args] = process.argv.slice(2);
if (!file || !cmd) {
  console.error("Usage: node scripts/with-env.mjs <env-file> <command> [args...]");
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`${file} not found. Copy .env.example to ${file} and fill in the production values.`);
  process.exit(1);
}
const child = spawn(cmd, args, { stdio: "inherit", shell: true, env: { ...process.env, ENV_FILE: file } });
child.on("exit", (code) => process.exit(code ?? 1));
