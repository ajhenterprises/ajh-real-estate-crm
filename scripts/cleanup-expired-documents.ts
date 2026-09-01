/**
 * Permanently deletes documents that have been PENDING_DELETION for at
 * least DOCUMENT_DELETION_RETENTION_DAYS (45, as of this writing) and
 * still pass the deletion-protection gate when re-checked right now. The
 * actual logic lives in src/lib/documents/mutations.ts's
 * cleanupExpiredDocuments — this script is a thin, operator-run wrapper
 * around it, matching every other standalone ops script in scripts/
 * (backup-database.ts, find-orphaned-documents.ts): reads DATABASE_URL
 * and the S3_ / DOCUMENT_STORAGE_ variables from the environment, prints
 * a clear report, never invoked automatically by the running application.
 *
 * UNLIKE find-orphaned-documents.ts, this script performs its real work
 * by default — completing a deletion an authorized user already initiated
 * 45+ days ago is the entire point of "automatic cleanup," not something
 * that needs a second explicit flag on top of the --dry-run escape hatch
 * below. This process's console output (one line per document, including
 * every failure) IS this operation's audit trail, the same convention
 * backup-database.ts and find-orphaned-documents.ts already use — no
 * separate audit table exists or is needed for this.
 *
 * No scheduler is configured anywhere in this codebase. Running this
 * automatically on a 45-day-relevant cadence (daily is plenty) is the
 * deploying environment's own responsibility — a cron job, a Vercel Cron
 * job pointed at a route that shells out to this, a GitHub Actions
 * scheduled workflow, whatever that environment already has. See the
 * README's Document Storage section.
 *
 * Usage:
 *   npm run db:cleanup-expired-documents              # runs for real
 *   npm run db:cleanup-expired-documents -- --dry-run   # report only
 */
import { prisma } from "../src/lib/db";
import { getStorageAdapter } from "../src/lib/storage";
import { cleanupExpiredDocuments, DOCUMENT_DELETION_RETENTION_DAYS } from "../src/lib/documents/mutations";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (dryRun) {
    // A true dry run shouldn't even attempt a storage delete. A minimal
    // no-op adapter reuses the exact same cleanupExpiredDocuments logic
    // (protection re-check, batching, failure isolation) so the report is
    // an accurate preview of what a real run would do, without touching
    // R2/local storage or the database.
    const previewStorage = {
      put: async () => {
        throw new Error("dry run: put() should never be called");
      },
      get: async () => {
        throw new Error("dry run: get() should never be called");
      },
      delete: async () => {
        /* dry run: pretend every delete succeeds */
      },
    };
    console.log(`Dry run — no files or rows will actually be deleted (retention: ${DOCUMENT_DELETION_RETENTION_DAYS} days).`);
    const result = await cleanupExpiredDocuments(prisma, previewStorage);
    report(result, true);
    return;
  }

  console.log(`Running document cleanup (retention: ${DOCUMENT_DELETION_RETENTION_DAYS} days)...`);
  const result = await cleanupExpiredDocuments(prisma, getStorageAdapter());
  report(result, false);
}

function report(
  result: Awaited<ReturnType<typeof cleanupExpiredDocuments>>,
  dryRun: boolean,
) {
  for (const doc of result.deleted) {
    console.log(`  ${dryRun ? "WOULD DELETE" : "DELETED"}: ${doc.id} (${doc.storagePath})`);
  }
  for (const doc of result.skippedProtected) {
    console.log(`  SKIPPED (protected): ${doc.id} — ${doc.reason}`);
  }
  for (const doc of result.failed) {
    console.error(`  FAILED: ${doc.id} — ${doc.error}`);
  }
  console.log("");
  console.log(
    `Summary: ${result.deleted.length} ${dryRun ? "would be deleted" : "deleted"}, ` +
      `${result.skippedProtected.length} protected (skipped), ${result.failed.length} failed.`,
  );
  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Cleanup run crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
