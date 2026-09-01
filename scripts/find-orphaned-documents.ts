/**
 * Finds (and, only with --delete, removes) files under the document storage
 * directory that have no matching `Document.storagePath` row in the
 * database — the manual reconciliation tool for Phase 8's documented,
 * accepted limitation: a Document row deleted via database-level cascade
 * (e.g. a User/Transaction/Client/Contact row removed by direct DB
 * administration — no application code path does this today) leaves its
 * physical file behind with no trace to clean it up automatically.
 *
 * LOCAL STORAGE ONLY: this script walks DOCUMENT_STORAGE_PATH on local
 * disk directly (see listFilesRecursive below) — it does not go through
 * the StorageAdapter interface and does not know how to list an S3-
 * compatible bucket. When DOCUMENT_STORAGE_DRIVER=s3 (see
 * src/lib/storage/index.ts), this script simply has nothing local to scan
 * and reports zero files/orphans; it is not a general reconciliation tool
 * for S3-backed deployments. Reconciling an S3 bucket would need its own,
 * separate tool (listing objects via the provider's API) — not built here,
 * since no production storage backend is configured yet. The pure
 * detection logic (findOrphanedPaths) itself is backend-agnostic — it just
 * diffs two lists of keys — so that part would carry over unchanged.
 *
 * SAFE BY DEFAULT: with no flags, this only reports what it finds. Nothing
 * is removed unless you pass --delete explicitly. Never run automatically —
 * not from application code, not from a request, not from a migration, not
 * from a deployment hook. Run by hand, read the report, then decide.
 *
 * Usage:
 *   npm run db:find-orphaned-documents            # report only
 *   npm run db:find-orphaned-documents -- --delete  # report AND remove
 */
import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Same resolution as LocalFilesystemStorageAdapter's constructor
// (src/lib/storage/local.ts) — duplicated deliberately rather than adding a
// "list files" method to the StorageAdapter interface for one ops script.
const STORAGE_ROOT = process.env.DOCUMENT_STORAGE_PATH || path.join(process.cwd(), ".data", "documents");

/**
 * Every file under root, as paths relative to root (matching the
 * `storagePath`/"key" format Document rows store). Exported alongside
 * findOrphanedPaths so an integration test can prove a cascade-deleted
 * parent's file is actually detected against a real disk + real database,
 * not just the pure set-difference logic in isolation.
 */
export async function listFilesRecursive(dir: string, root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath, root)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, fullPath));
    }
  }
  return files;
}

/**
 * Pure detection logic — no filesystem/DB access — kept separate so it's
 * directly unit-testable (see find-orphaned-documents.test.ts) without a
 * real disk or database.
 */
export function findOrphanedPaths(filesOnDisk: string[], storagePathsInDb: string[]): string[] {
  const known = new Set(storagePathsInDb);
  return filesOnDisk.filter((file) => !known.has(file));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const shouldDelete = process.argv.includes("--delete");

    const documents = await prisma.document.findMany({ select: { storagePath: true } });
    const storagePathsInDb = documents.map((d) => d.storagePath);

    const filesOnDisk = await listFilesRecursive(STORAGE_ROOT, STORAGE_ROOT);
    const orphaned = findOrphanedPaths(filesOnDisk, storagePathsInDb);

    console.log(`Storage root: ${STORAGE_ROOT}`);
    console.log(`Files on disk: ${filesOnDisk.length}`);
    console.log(`Document rows: ${storagePathsInDb.length}`);
    console.log(`Orphaned files (on disk, no matching Document row): ${orphaned.length}`);

    if (orphaned.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    for (const file of orphaned) {
      const fullPath = path.join(STORAGE_ROOT, file);
      const size = await stat(fullPath).then((s) => s.size).catch(() => null);
      console.log(`  ${shouldDelete ? "DELETING" : "ORPHANED"}: ${file}${size !== null ? ` (${size} bytes)` : ""}`);
      if (shouldDelete) {
        await unlink(fullPath);
      }
    }

    console.log(
      shouldDelete
        ? `Deleted ${orphaned.length} orphaned file(s).`
        : `Found ${orphaned.length} orphaned file(s). Re-run with --delete to remove them.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
