import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, rm } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";

const execFileAsync = promisify(execFile);

/**
 * Runs backup-database.ts and restore-database.ts as real child processes —
 * exactly how `npm run db:backup` / `npm run db:restore` invoke them — but
 * with DATABASE_URL forced to TEST_DATABASE_URL, so pg_dump/psql only ever
 * touch the dedicated, disposable test database (see src/test/db.ts), never
 * the dev or a production database. Skips entirely when no test database is
 * configured, same convention as every other *.integration.test.ts file.
 */
describe.skipIf(!hasTestDatabase)("backup-database / restore-database (integration)", () => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL!;
  let backupDir: string;

  afterEach(async () => {
    if (backupDir) await rm(backupDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("backs up the test database to a .sql file, and restoring it recreates deleted data", async () => {
    await resetTestDatabase();
    const db = getTestDb();
    const user = await createTestUser({ email: "backup-restore-fixture@example.com" });

    backupDir = await mkdtemp(path.join(tmpdir(), "ajh-crm-backup-test-"));

    const backupEnv = { ...process.env, DATABASE_URL: testDatabaseUrl, BACKUP_DIR: backupDir };
    const backupResult = await execFileAsync(
      "node_modules/.bin/tsx",
      ["scripts/backup-database.ts"],
      { env: backupEnv, cwd: process.cwd() },
    );
    expect(backupResult.stdout).toContain("Backup complete.");

    const files = await readdir(backupDir);
    expect(files).toHaveLength(1);
    const backupFile = path.join(backupDir, files[0]);

    // Prove the dump really captured this fixture's data, not just that a
    // file exists: it should contain the fixture user's email.
    const { readFile } = await import("node:fs/promises");
    const dumpContents = await readFile(backupFile, "utf8");
    expect(dumpContents).toContain(user.email);

    // Simulate data loss, then restore from the backup we just took.
    await resetTestDatabase();
    const missingAfterReset = await db.user.findUnique({ where: { email: user.email } });
    expect(missingAfterReset).toBeNull();

    const restoreEnv = { ...process.env, DATABASE_URL: testDatabaseUrl };
    const restoreResult = await execFileAsync(
      "node_modules/.bin/tsx",
      ["scripts/restore-database.ts", backupFile, "--yes"],
      { env: restoreEnv, cwd: process.cwd() },
    );
    expect(restoreResult.stdout).toContain("Restore complete.");

    const restoredUser = await db.user.findUnique({ where: { email: user.email } });
    expect(restoredUser).not.toBeNull();
    expect(restoredUser?.id).toBe(user.id);

    // Leave the test database clean for the next test file.
    await resetTestDatabase();
  }, 30000);

  it("restore-database.ts refuses to run without an explicit file argument or --yes-less confirmation path", async () => {
    const restoreEnv = { ...process.env, DATABASE_URL: testDatabaseUrl };
    await expect(
      execFileAsync("node_modules/.bin/tsx", ["scripts/restore-database.ts"], { env: restoreEnv, cwd: process.cwd() }),
    ).rejects.toMatchObject({ code: 1 });
  });
});
