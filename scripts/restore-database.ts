/**
 * Restores a plain-SQL backup (produced by backup-database.ts) into the
 * database at DATABASE_URL, via psql. Never invoked by the running
 * application. Deliberately hard to trigger by accident:
 *   - requires an explicit backup-file path argument
 *   - prints the (password-masked) target connection string
 *   - requires typing "yes" interactively before proceeding, unless --yes
 *     is passed explicitly (for scripted use against a non-production
 *     target — e.g. this project's own isolated test database)
 *
 * Usage:
 *   npm run db:restore -- backups/ajh-crm-db-2026-09-01T12-00-00-000Z.sql
 *   npm run db:restore -- <file> --yes   # skip the interactive prompt
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";

const execFileAsync = promisify(execFile);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// Prisma connection strings carry a `?schema=` query parameter that only
// Prisma's own client understands — libpq (what pg_dump/psql use) rejects
// it outright ("invalid URI query parameter: schema"). Postgres already
// defaults to the "public" schema this project uses, so it's safe to drop.
function toLibpqConnectionString(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

const connectionString = toLibpqConnectionString(requireEnv("DATABASE_URL"));

function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    return parsed.toString();
  } catch {
    return "(connection string could not be parsed for display)";
  }
}

async function main() {
  const args = process.argv.slice(2);
  const skipConfirmation = args.includes("--yes");
  const file = args.find((arg) => !arg.startsWith("--"));

  if (!file) {
    console.error("Usage: npm run db:restore -- <backup-file.sql> [--yes]");
    process.exitCode = 1;
    return;
  }
  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exitCode = 1;
    return;
  }

  console.log(`About to restore "${file}" into: ${maskConnectionString(connectionString)}`);
  console.log("This will drop and recreate every object present in that backup file.");

  if (!skipConfirmation) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "yes" to continue, anything else to abort: ');
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") {
      console.log("Aborted — nothing was restored.");
      return;
    }
  }

  console.log("Restoring...");
  await execFileAsync("psql", ["--file", file, connectionString]);
  console.log("Restore complete.");
  console.log(
    "Reminder: this restores the database only. If you're recovering from a real " +
      "incident, also restore the document-storage directory from its own backup, " +
      "then run `npx prisma migrate status` to confirm the schema matches this codebase.",
  );
}

main().catch((error) => {
  console.error("Restore failed:", error);
  process.exitCode = 1;
});
