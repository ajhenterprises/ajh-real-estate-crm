import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getStorageAdapter, type StorageAdapter } from "@/lib/storage";

/**
 * Document deletion/retention lifecycle. See prisma/schema.prisma's
 * Document model comment for the two-phase design this implements:
 *
 *   1. deleteDocument (soft delete) — moves an owned, unprotected document
 *      to PENDING_DELETION and records who/when. Storage is never touched.
 *   2. cleanupExpiredDocuments (hard delete) — permanently removes
 *      documents that have been PENDING_DELETION for at least
 *      DOCUMENT_DELETION_RETENTION_DAYS and still pass the protection
 *      check when re-checked at that moment. File deleted before row,
 *      same ENOENT-tolerant ordering deleteDocument always used.
 *
 * restoreDocument reverses step 1 at any point before step 2 runs.
 * src/lib/tax-expenses/mutations.ts's removeExpenseReceipt is a third,
 * expense-aware caller of the same underlying soft-delete write (see
 * markDocumentPendingDeletion below) — it deliberately unlinks a document
 * from its Expense first so checkDocumentDeletionProtection no longer
 * blocks it, the one legitimate way to remove an expense's receipt.
 *
 * Same shape as src/lib/contacts/mutations.ts throughout: no
 * `import "server-only"`, optional trailing overrides (a Prisma client,
 * a StorageAdapter, a `now` for deterministic date-boundary testing) each
 * defaulting to the real thing — so every function here is directly
 * testable against the dedicated test database without new mocking
 * infrastructure.
 */

export const DOCUMENT_DELETION_RETENTION_DAYS = 45;

function isFileNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

/**
 * A document is owned transitively through whichever of transaction /
 * client / contact / expense it's attached to. Shared by every
 * ownership-scoped Document query in this codebase (this file, actions.ts,
 * repos/documents.ts) so adding a new attachment point — as `expense`
 * was — is one change, not four independently-drifting copies of the same
 * OR clause.
 */
export function documentOwnershipFilter(userId: string): Prisma.DocumentWhereInput {
  return {
    OR: [
      { transaction: { ownerId: userId } },
      { client: { ownerId: userId } },
      { contact: { ownerId: userId } },
      { expense: { ownerId: userId } },
    ],
  };
}

// A small, append-only audit trail reusing Document.metadata (already a
// "free-form metadata bag ... so the schema doesn't need to grow a column
// per detail concern" per its own doc comment) rather than a new table.
// Permanent deletion isn't recorded here — the row is gone by definition —
// see cleanupExpiredDocuments' own console output for that event and any
// failures, the same audit mechanism every other operator script in this
// codebase already uses (backup-database.ts, find-orphaned-documents.ts).
type DocumentLifecycleEvent =
  | { type: "deletion-initiated"; at: string; byUserId: string }
  | { type: "restored"; at: string; byUserId: string };

function appendLifecycleEvent(existingMetadata: Prisma.JsonValue | null, event: DocumentLifecycleEvent): Prisma.InputJsonValue {
  const base = existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata) ? existingMetadata : {};
  const priorEvents = Array.isArray((base as { lifecycleEvents?: unknown }).lifecycleEvents)
    ? ((base as { lifecycleEvents: DocumentLifecycleEvent[] }).lifecycleEvents)
    : [];
  return { ...base, lifecycleEvents: [...priorEvents, event] } as Prisma.InputJsonValue;
}

/**
 * Centralized pre-storage-deletion protection gate — see the extended
 * design note in prisma/schema.prisma's Document model comment. Every rule
 * that must block a document from ever being physically deleted, no
 * matter how long it has been PENDING_DELETION, belongs here. Called by
 * both deleteDocument (so a protected document is never even scheduled)
 * and cleanupExpiredDocuments (re-checked fresh immediately before the
 * physical delete — protection state can change during the 45-day
 * window, so the value cached from initiation is never trusted here).
 *
 * Takes the document's own id/expenseId rather than re-querying by id:
 * expenseId is a plain scalar already present on any already-fetched
 * Document row, so checking it costs nothing extra, unlike
 * ContractInformation (a separate table, genuinely needing its own
 * lookup). This is also the extension point for a future document-
 * carrying feature's own retention rule — one more field/existence check
 * here, in the same shape.
 */
export interface DocumentProtectionResult {
  protected: boolean;
  reason?: string;
}

export async function checkDocumentDeletionProtection(
  db: Prisma.TransactionClient,
  document: { id: string; expenseId: string | null },
): Promise<DocumentProtectionResult> {
  if (document.expenseId) {
    return {
      protected: true,
      reason: "This document is attached to an expense record and can't be deleted.",
    };
  }
  const contractInformation = await db.contractInformation.findUnique({
    where: { documentId: document.id },
    select: { id: true },
  });
  if (contractInformation) {
    return {
      protected: true,
      reason: "This document has contract information built from it and can't be deleted.",
    };
  }
  return { protected: false };
}

/** The write shared by every path that actually soft-deletes a document (deleteDocument below, and tax-expenses/mutations.ts's removeExpenseReceipt). Callers are responsible for authorization and the protection check — this just performs the state transition. */
export async function markDocumentPendingDeletion(
  db: Prisma.TransactionClient,
  document: { id: string; metadata: Prisma.JsonValue | null },
  userId: string,
  now: Date,
): Promise<void> {
  await db.document.update({
    where: { id: document.id },
    data: {
      status: "PENDING_DELETION",
      deletionInitiatedAt: now,
      deletionInitiatedByUserId: userId,
      metadata: appendLifecycleEvent(document.metadata, {
        type: "deletion-initiated",
        at: now.toISOString(),
        byUserId: userId,
      }),
    },
  });
}

export type DeleteDocumentResult =
  | { outcome: "pending-deletion"; transactionId: string | null }
  | { outcome: "not-found" }
  | { outcome: "protected"; reason: string };

/** Owner-scoped soft delete: schedules a document for permanent deletion in DOCUMENT_DELETION_RETENTION_DAYS. Never touches storage. */
export async function deleteDocument(
  userId: string,
  documentId: string,
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<DeleteDocumentResult> {
  const document = await db.document.findFirst({
    where: { id: documentId, ...documentOwnershipFilter(userId) },
  });
  if (!document) return { outcome: "not-found" };

  const protection = await checkDocumentDeletionProtection(db, document);
  if (protection.protected) {
    return { outcome: "protected", reason: protection.reason! };
  }

  await markDocumentPendingDeletion(db, document, userId, now);

  return { outcome: "pending-deletion", transactionId: document.transactionId };
}

export type RestoreDocumentResult = { outcome: "restored"; transactionId: string | null } | { outcome: "not-found" };

/**
 * Owner-scoped restore: cancels a pending deletion and returns the
 * document to UPLOADED. Never touches storage — soft delete never did
 * either, so there is nothing to undo there. Safe to call more than once:
 * a document that isn't (or is no longer) PENDING_DELETION simply isn't
 * matched by the where clause, so a repeat call reports "not-found"
 * rather than erroring — the same idempotent-no-op convention every other
 * mutation in this codebase uses.
 */
export async function restoreDocument(
  userId: string,
  documentId: string,
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<RestoreDocumentResult> {
  const document = await db.document.findFirst({
    where: { id: documentId, status: "PENDING_DELETION", ...documentOwnershipFilter(userId) },
  });
  if (!document) return { outcome: "not-found" };

  await db.document.update({
    where: { id: document.id },
    data: {
      status: "UPLOADED",
      deletionInitiatedAt: null,
      deletionInitiatedByUserId: null,
      metadata: appendLifecycleEvent(document.metadata, {
        type: "restored",
        at: now.toISOString(),
        byUserId: userId,
      }),
    },
  });

  return { outcome: "restored", transactionId: document.transactionId };
}

export interface CleanupExpiredDocumentsResult {
  deleted: { id: string; storagePath: string }[];
  skippedProtected: { id: string; reason: string }[];
  failed: { id: string; error: string }[];
}

/**
 * Permanently deletes every document that has been PENDING_DELETION for
 * at least DOCUMENT_DELETION_RETENTION_DAYS and still passes
 * checkDocumentDeletionProtection when re-checked right now — never
 * relying on protection state from whenever deletion was initiated.
 * Processes documents one at a time so a single failure (a real storage
 * error, not ENOENT) never stops the rest of the batch; that document's
 * row and file are simply left untouched for the next run to retry.
 * Never reports a document as deleted unless its R2/storage object is
 * actually confirmed gone (or was already gone) — file deleted before
 * row, same ordering and ENOENT-tolerance as the original deleteDocument.
 */
export async function cleanupExpiredDocuments(
  db: Prisma.TransactionClient = prisma,
  storage: StorageAdapter = getStorageAdapter(),
  now: Date = new Date(),
): Promise<CleanupExpiredDocumentsResult> {
  const cutoff = new Date(now.getTime() - DOCUMENT_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db.document.findMany({
    where: { status: "PENDING_DELETION", deletionInitiatedAt: { lte: cutoff } },
    select: { id: true, storagePath: true, expenseId: true },
  });

  const result: CleanupExpiredDocumentsResult = { deleted: [], skippedProtected: [], failed: [] };

  for (const candidate of candidates) {
    try {
      const protection = await checkDocumentDeletionProtection(db, candidate);
      if (protection.protected) {
        result.skippedProtected.push({ id: candidate.id, reason: protection.reason! });
        continue;
      }

      try {
        await storage.delete(candidate.storagePath);
      } catch (error) {
        if (!isFileNotFoundError(error)) {
          result.failed.push({ id: candidate.id, error: error instanceof Error ? error.message : String(error) });
          continue;
        }
        // ENOENT: already gone — proceed to remove the row too.
      }

      await db.document.delete({ where: { id: candidate.id } });
      result.deleted.push({ id: candidate.id, storagePath: candidate.storagePath });
    } catch (error) {
      // Anything unexpected (e.g. the row vanished between the query and
      // here) — record and move on, never let one document abort the batch.
      result.failed.push({ id: candidate.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return result;
}
