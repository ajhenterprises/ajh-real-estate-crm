/**
 * Dumps the database at DATABASE_URL to a timestamped, plain-SQL file under
 * backups/ (git-ignored) using pg_dump. Never invoked by the running
 * application — a standalone operator tool, run by hand or wired into
 * whatever scheduling mechanism the actual deployment provides (that
 * scheduling is explicitly deployment-time configuration; see README's
 * Backup & Recovery section).
 *
 * Uses execFile (never a shell) so the connection string is passed as one
 * argument, never interpolated into a command line.
 *
 * Usage: npm run db:backup
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import path from "node:path";

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
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");

async function main() {
  await mkdir(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputFile = path.join(BACKUP_DIR, `ajh-crm-db-${timestamp}.sql`);

  console.log(`Backing up database to ${outputFile} ...`);

  // --format=plain: a human-readable/inspectable .sql file, restorable with
  // a plain `psql -f`, matching restore-database.ts.
  // --clean --if-exists: the dump includes DROP statements before each
  // CREATE, so restoring is safe to run against a target that already has
  // some or all of these objects (an empty database restores cleanly too —
  // the DROP IF EXISTS statements are simply no-ops).
  // --no-owner --no-privileges: this app connects as a single application
  // role; omitting ownership/grant statements avoids a restore failing
  // against a target where that exact role doesn't exist.
  const args: string[] = [
    "--format=plain",
    "--no-owner",
    "--no-privileges",
    "--clean",
    "--if-exists",
    "--file",
    outputFile,
    connectionString,
  ];
  await execFileAsync("pg_dump", args, {});

  console.log("Backup complete.");
  console.log(
    "Reminder: this backs up the database only. The document-storage directory " +
      "(DOCUMENT_STORAGE_PATH) needs its own, separate backup — see README's Backup & Recovery section.",
  );
}

main().catch((error) => {
  console.error("Backup failed:", error);
  process.exitCode = 1;
});
