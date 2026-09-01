import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getStorageAdapter, type StorageAdapter } from "@/lib/storage";

/**
 * Owner-scoped document deletion, factored out of the "use server" actions
 * file (src/lib/documents/actions.ts) so this exact logic — not a
 * reimplementation of it — is directly callable from integration tests
 * against the dedicated test database (src/test/db.ts). Same shape as
 * src/lib/contacts/mutations.ts: no `import "server-only"`, optional
 * trailing overrides (a Prisma client, and here also a StorageAdapter) each
 * defaulting to the real singleton.
 *
 * Ordering and failure semantics (Phase 8): the physical file is deleted
 * *before* the database row, and only a genuinely-missing file (ENOENT) is
 * treated as already-deleted-and-fine. Any other storage error aborts
 * before the row is touched. True cross-system atomicity between Postgres
 * and the filesystem isn't possible, so this picks the failure mode that
 * can never silently orphan a file: if the DB delete fails after a
 * successful file delete, the row is merely stale (discoverable, harmless);
 * if it were the other way around — row gone, file delete failed — the
 * file would be orphaned with no trace anywhere, which is the exact
 * problem this exists to close. Deleting twice is safe: the second call's
 * ownership lookup simply finds nothing and reports "not-found", the same
 * silent-no-op convention every other action in this codebase already uses.
 */

export type DeleteDocumentResult =
  | { outcome: "deleted"; transactionId: string | null }
  | { outcome: "not-found" }
  | { outcome: "storage-error"; error: unknown };

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

export async function deleteDocument(
  userId: string,
  documentId: string,
  db: Prisma.TransactionClient = prisma,
  storage: StorageAdapter = getStorageAdapter(),
): Promise<DeleteDocumentResult> {
  const document = await db.document.findFirst({
    where: {
      id: documentId,
      OR: [
        { transaction: { ownerId: userId } },
        { client: { ownerId: userId } },
        { contact: { ownerId: userId } },
      ],
    },
  });
  if (!document) return { outcome: "not-found" };

  try {
    await storage.delete(document.storagePath);
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      // Not "already gone" — a real storage failure (permissions, I/O,
      // etc). Abort here: the DB row and the file both still exist,
      // consistent with each other, and the agent can retry.
      return { outcome: "storage-error", error };
    }
    // ENOENT: the file was already missing. The desired end state (no file
    // on disk) already holds, so proceed to remove the row too.
  }

  await db.document.delete({ where: { id: document.id } });
  return { outcome: "deleted", transactionId: document.transactionId };
}
