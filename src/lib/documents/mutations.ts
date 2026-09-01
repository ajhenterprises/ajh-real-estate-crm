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
 *
 * Deletion protection — checked BEFORE any storage mutation: some
 * documents must never be deleted at all, regardless of what happens to
 * the file. `ContractInformation.document` already declares this via
 * `onDelete: Restrict` (a CONTRACT document with confirmed contract
 * information behind it can't be deleted out from under it) — but that
 * constraint only fires on the *database row* delete, which used to run
 * *after* the file was already gone from storage, so a "protected"
 * document's file was destroyed anyway, unrecoverably, before Postgres
 * ever got a chance to object (reproduced directly against the real
 * Restrict constraint while designing this fix). The check below queries
 * for that same protecting relation up front and refuses to touch
 * anything — file included — if it's present. This is also the single
 * place a future protection rule must be added (e.g. a not-yet-built
 * tax/expense record with its own retention requirement): another
 * `db.<futureModel>.findUnique/findFirst` check alongside the one below,
 * still before `storage.delete()`. Never move a protection check to after
 * the storage delete — that's exactly the bug this fixes.
 */

export type DeleteDocumentResult =
  | { outcome: "deleted"; transactionId: string | null }
  | { outcome: "not-found" }
  | { outcome: "protected"; reason: string }
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

  const contractInformation = await db.contractInformation.findUnique({
    where: { documentId: document.id },
    select: { id: true },
  });
  if (contractInformation) {
    return {
      outcome: "protected",
      reason: "This document has contract information built from it and can't be deleted.",
    };
  }

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
