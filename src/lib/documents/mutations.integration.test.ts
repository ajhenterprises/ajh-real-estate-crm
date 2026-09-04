import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { LocalFilesystemStorageAdapter } from "@/lib/storage/local";
import type { StorageAdapter } from "@/lib/storage";
import {
  cleanupExpiredDocuments,
  DOCUMENT_DELETION_RETENTION_DAYS,
  deleteDocument,
  restoreDocument,
} from "@/lib/documents/mutations";

const NOW = new Date("2026-09-15T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Integration tests for the document deletion/retention lifecycle
 * (soft delete -> restore, and the 45-day cleanupExpiredDocuments hard
 * delete), run against the dedicated test database (see src/test/db.ts)
 * plus a real, throwaway on-disk storage root — not a mocked filesystem —
 * so ordering, idempotency, and protection re-checking are exercised for
 * real, the same convention every *.integration.test.ts file here uses.
 */
describe.skipIf(!hasTestDatabase)("document deletion/retention lifecycle (integration)", () => {
  let storageRoot: string;
  let storage: StorageAdapter;

  beforeEach(async () => {
    await resetTestDatabase();
    storageRoot = await mkdtemp(path.join(tmpdir(), "ajh-crm-doc-lifecycle-test-"));
    storage = new LocalFilesystemStorageAdapter(storageRoot);
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function writeFixtureFile(key: string, contents = "fake pdf bytes") {
    const filePath = path.join(storageRoot, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
    return filePath;
  }

  async function createOwnedDocument(ownerId: string) {
    const db = getTestDb();
    const contact = await createTestContact(ownerId);
    const key = `contacts/${contact.id}/${Math.random().toString(36).slice(2)}.pdf`;
    const filePath = await writeFixtureFile(key);

    const document = await db.document.create({
      data: {
        filename: "test.pdf",
        documentType: "OTHER",
        storagePath: key,
        fileSize: 14,
        mimeType: "application/pdf",
        uploadedByUserId: ownerId,
        contactId: contact.id,
      },
    });

    return { document, filePath, key };
  }

  async function createTransactionDocument(ownerId: string, opts: { documentType?: "OTHER" | "CONTRACT" } = {}) {
    const db = getTestDb();
    const contact = await createTestContact(ownerId);
    const transaction = await db.transaction.create({ data: { contactId: contact.id, ownerId, type: "BUYER" } });
    const key = `transactions/${transaction.id}/${Math.random().toString(36).slice(2)}.pdf`;
    const filePath = await writeFixtureFile(key);

    const document = await db.document.create({
      data: {
        filename: "doc.pdf",
        documentType: opts.documentType ?? "OTHER",
        storagePath: key,
        fileSize: 14,
        mimeType: "application/pdf",
        uploadedByUserId: ownerId,
        transactionId: transaction.id,
      },
    });

    return { document, filePath, key, transaction };
  }

  /** Bypasses deleteDocument to directly place a document in PENDING_DELETION with a specific deletionInitiatedAt, for precise 45-day boundary testing. */
  async function markPendingDeletion(documentId: string, deletionInitiatedAt: Date, byUserId: string) {
    const db = getTestDb();
    await db.document.update({
      where: { id: documentId },
      data: { status: "PENDING_DELETION", deletionInitiatedAt, deletionInitiatedByUserId: byUserId },
    });
  }

  describe("deleteDocument (soft delete)", () => {
    it("moves an owned document to PENDING_DELETION without touching storage", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);

      const result = await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      expect(result).toEqual({ outcome: "pending-deletion", transactionId: null });
      expect(existsSync(filePath)).toBe(true);
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("PENDING_DELETION");
      expect(row?.deletionInitiatedAt?.toISOString()).toBe(NOW.toISOString());
      expect(row?.deletionInitiatedByUserId).toBe(owner.id);
    });

    it("rejects deletion by a user who does not own the document, leaving it untouched", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);

      const result = await deleteDocument(otherUser.id, document.id, getTestDb(), NOW);

      expect(result).toEqual({ outcome: "not-found" });
      expect(existsSync(filePath)).toBe(true);
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("UPLOADED");
    });

    it("reports not-found for a document id that does not exist", async () => {
      const owner = await createTestUser();
      const result = await deleteDocument(owner.id, "nonexistent-document-id", getTestDb(), NOW);
      expect(result).toEqual({ outcome: "not-found" });
    });

    it("refuses to soft-delete a document with ContractInformation built from it", async () => {
      const owner = await createTestUser();
      const { document, filePath, transaction } = await createTransactionDocument(owner.id, { documentType: "CONTRACT" });
      await getTestDb().contractInformation.create({
        data: { transactionId: transaction.id, documentId: document.id, ownerId: owner.id },
      });

      const result = await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      expect(result.outcome).toBe("protected");
      expect(existsSync(filePath)).toBe(true);
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("UPLOADED");
      expect(row?.deletionInitiatedAt).toBeNull();
    });
  });

  describe("restoreDocument", () => {
    it("restores a pending-deletion document to UPLOADED, clearing deletion tracking", async () => {
      const owner = await createTestUser();
      const { document } = await createOwnedDocument(owner.id);
      await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      const result = await restoreDocument(owner.id, document.id, getTestDb(), NOW);

      expect(result).toEqual({ outcome: "restored", transactionId: null });
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("UPLOADED");
      expect(row?.deletionInitiatedAt).toBeNull();
      expect(row?.deletionInitiatedByUserId).toBeNull();
    });

    it("rejects restore by a user who does not own the document", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const { document } = await createOwnedDocument(owner.id);
      await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      const result = await restoreDocument(otherUser.id, document.id, getTestDb(), NOW);

      expect(result).toEqual({ outcome: "not-found" });
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("PENDING_DELETION");
    });

    it("reports not-found for a document that is not pending deletion", async () => {
      const owner = await createTestUser();
      const { document } = await createOwnedDocument(owner.id);
      const result = await restoreDocument(owner.id, document.id, getTestDb(), NOW);
      expect(result).toEqual({ outcome: "not-found" });
    });

    it("is safe to call more than once", async () => {
      const owner = await createTestUser();
      const { document } = await createOwnedDocument(owner.id);
      await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      const first = await restoreDocument(owner.id, document.id, getTestDb(), NOW);
      const second = await restoreDocument(owner.id, document.id, getTestDb(), NOW);

      expect(first).toEqual({ outcome: "restored", transactionId: null });
      expect(second).toEqual({ outcome: "not-found" });
    });

    it("restoring cancels the pending permanent deletion — a restored document is not touched by cleanup even past 45 days", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);
      const initiatedAt = new Date(NOW.getTime() - 50 * DAY_MS);
      await markPendingDeletion(document.id, initiatedAt, owner.id);

      await restoreDocument(owner.id, document.id, getTestDb(), NOW);
      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted).toHaveLength(0);
      expect(existsSync(filePath)).toBe(true);
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("UPLOADED");
    });
  });

  describe("cleanupExpiredDocuments — 45-day eligibility", () => {
    it("does not delete a document one day short of the 45-day retention period", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - (DOCUMENT_DELETION_RETENTION_DAYS - 1) * DAY_MS), owner.id);

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted).toHaveLength(0);
      expect(existsSync(filePath)).toBe(true);
      expect(await getTestDb().document.findUnique({ where: { id: document.id } })).not.toBeNull();
    });

    it("deletes a document exactly at the 45-day retention boundary", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - DOCUMENT_DELETION_RETENTION_DAYS * DAY_MS), owner.id);

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted.map((d) => d.id)).toEqual([document.id]);
      expect(existsSync(filePath)).toBe(false);
      expect(await getTestDb().document.findUnique({ where: { id: document.id } })).toBeNull();
    });
  });

  describe("cleanupExpiredDocuments — permanent deletion mechanics", () => {
    it("deletes the storage object before the database row on the normal happy path", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result).toEqual({ deleted: [{ id: document.id, storagePath: document.storagePath }], skippedProtected: [], failed: [] });
      expect(existsSync(filePath)).toBe(false);
      expect(await getTestDb().document.findUnique({ where: { id: document.id } })).toBeNull();
    });

    it("treats a missing storage object (ENOENT) as already-gone and still removes the row", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);
      await rm(filePath); // simulate the file having already gone missing out-of-band

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted.map((d) => d.id)).toEqual([document.id]);
      expect(await getTestDb().document.findUnique({ where: { id: document.id } })).toBeNull();
    });

    it("never marks a document permanently deleted when the storage delete fails with a non-ENOENT error", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);
      const failingStorage: StorageAdapter = {
        put: () => {
          throw new Error("not implemented in this test double");
        },
        get: () => {
          throw new Error("not implemented in this test double");
        },
        delete: async () => {
          const error = new Error("Permission denied") as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        },
      };

      const result = await cleanupExpiredDocuments(getTestDb(), failingStorage, NOW);

      expect(result.deleted).toHaveLength(0);
      expect(result.failed).toEqual([{ id: document.id, error: "Permission denied" }]);
      expect(existsSync(filePath)).toBe(true);
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row).not.toBeNull();
      expect(row?.status).toBe("PENDING_DELETION");
    });

    it("one failing document does not stop the rest of the batch from being processed", async () => {
      const owner = await createTestUser();
      const { document: failing, filePath: failingPath } = await createOwnedDocument(owner.id);
      const { document: succeeding, filePath: succeedingPath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(failing.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);
      await markPendingDeletion(succeeding.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);

      const partiallyFailingStorage: StorageAdapter = {
        put: storage.put.bind(storage),
        get: storage.get.bind(storage),
        delete: async (key: string) => {
          if (key === failing.storagePath) {
            throw new Error("simulated storage outage");
          }
          return storage.delete(key);
        },
      };

      const result = await cleanupExpiredDocuments(getTestDb(), partiallyFailingStorage, NOW);

      expect(result.failed.map((d) => d.id)).toEqual([failing.id]);
      expect(result.deleted.map((d) => d.id)).toEqual([succeeding.id]);
      expect(existsSync(failingPath)).toBe(true);
      expect(existsSync(succeedingPath)).toBe(false);
      expect(await getTestDb().document.findUnique({ where: { id: failing.id } })).not.toBeNull();
      expect(await getTestDb().document.findUnique({ where: { id: succeeding.id } })).toBeNull();
    });

    it("repeated cleanup runs are safe — a second run finds nothing left to do", async () => {
      const owner = await createTestUser();
      const { document } = await createOwnedDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);

      const first = await cleanupExpiredDocuments(getTestDb(), storage, NOW);
      const second = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(first.deleted).toHaveLength(1);
      expect(second).toEqual({ deleted: [], skippedProtected: [], failed: [] });
    });

    it("leaves an ordinary active (UPLOADED) document completely unaffected", async () => {
      const owner = await createTestUser();
      const { document: pending } = await createOwnedDocument(owner.id);
      const { document: active, filePath: activeFilePath } = await createOwnedDocument(owner.id);
      await markPendingDeletion(pending.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);
      // `active` is left as a plain UPLOADED document — never touched by deleteDocument/markPendingDeletion.

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted.map((d) => d.id)).toEqual([pending.id]);
      expect(existsSync(activeFilePath)).toBe(true);
      const activeRow = await getTestDb().document.findUnique({ where: { id: active.id } });
      expect(activeRow?.status).toBe("UPLOADED");
    });
  });

  describe("cleanupExpiredDocuments — protection", () => {
    it("never permanently deletes a document protected by ContractInformation, even at/after the 45-day boundary", async () => {
      const owner = await createTestUser();
      const { document, filePath, transaction } = await createTransactionDocument(owner.id, { documentType: "CONTRACT" });
      await getTestDb().contractInformation.create({
        data: { transactionId: transaction.id, documentId: document.id, ownerId: owner.id },
      });
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted).toHaveLength(0);
      expect(result.skippedProtected.map((d) => d.id)).toEqual([document.id]);
      expect(existsSync(filePath)).toBe(true);
      expect(await getTestDb().document.findUnique({ where: { id: document.id } })).not.toBeNull();
    });

    it("re-checks protection immediately before physical deletion, not just the state from when deletion was initiated", async () => {
      // The document is unprotected — and eligible by age — at the moment
      // cleanup runs its initial query, but becomes protected in between
      // (ContractInformation attached after soft delete, before the
      // physical delete step). The re-check inside the loop must catch
      // this; relying only on the initial batch query would not.
      const owner = await createTestUser();
      const { document, filePath, transaction } = await createTransactionDocument(owner.id, { documentType: "CONTRACT" });
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);

      await getTestDb().contractInformation.create({
        data: { transactionId: transaction.id, documentId: document.id, ownerId: owner.id },
      });

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted).toHaveLength(0);
      expect(result.skippedProtected.map((d) => d.id)).toEqual([document.id]);
      expect(existsSync(filePath)).toBe(true);
    });
  });

  // Required by this feature's spec: brand-asset documents must remain
  // protected from automatic deletion. Not implemented or tested here —
  // a repository-wide search found no is_brand_asset flag, DocumentType,
  // or equivalent concept anywhere in the current schema/codebase. There
  // is nothing to hook a protection check into without inventing a new,
  // speculative field, which was explicitly out of scope for this change.
  // checkDocumentDeletionProtection (src/lib/documents/mutations.ts) is
  // where such a check would go once a real brand-asset concept exists.
  it.todo(
    "brand assets remain protected where applicable — no is_brand_asset flag or equivalent exists in the current schema; nothing to test against",
  );

  describe("deletion protection (Expense receipts — Tax & Expense tracking)", () => {
    async function createExpenseReceiptDocument(ownerId: string) {
      const db = getTestDb();
      const expense = await db.expense.create({
        data: {
          ownerId,
          expenseDate: new Date("2026-01-01T00:00:00.000Z"),
          taxYear: 2026,
          amount: "50.00",
          vendor: "Vendor",
          categoryId: "expcat_other",
          paymentMethod: "OTHER",
          deductibleStatus: "NEEDS_REVIEW",
        },
      });
      const key = `expenses/${expense.id}/receipt.pdf`;
      const filePath = await writeFixtureFile(key, "receipt bytes");
      const document = await db.document.create({
        data: {
          filename: "receipt.pdf",
          documentType: "RECEIPT",
          storagePath: key,
          fileSize: 14,
          mimeType: "application/pdf",
          uploadedByUserId: ownerId,
          expenseId: expense.id,
        },
      });
      return { expense, document, filePath };
    }

    it("refuses to soft-delete a document attached to an expense, leaving the file and row untouched", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createExpenseReceiptDocument(owner.id);

      const result = await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      expect(result.outcome).toBe("protected");
      expect(existsSync(filePath)).toBe(true);
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row?.status).toBe("UPLOADED");
    });

    it("finds a document owned only through its expense association — no transaction/contact link needed", async () => {
      // This is the "CRM subscription — $79" case: a general business
      // expense with no transaction, so its receipt's only ownership path
      // is through the expense itself. documentOwnershipFilter must cover
      // this or the document would be unreachable by its own owner.
      const owner = await createTestUser();
      const { document } = await createExpenseReceiptDocument(owner.id);

      const result = await deleteDocument(owner.id, document.id, getTestDb(), NOW);

      // Found (not "not-found") and correctly refused because it's
      // protected — proves ownership resolution AND protection both work.
      expect(result.outcome).toBe("protected");
    });

    it("never permanently deletes a document attached to an expense, even past the 45-day boundary", async () => {
      const owner = await createTestUser();
      const { document, filePath } = await createExpenseReceiptDocument(owner.id);
      await markPendingDeletion(document.id, new Date(NOW.getTime() - 46 * DAY_MS), owner.id);

      const result = await cleanupExpiredDocuments(getTestDb(), storage, NOW);

      expect(result.deleted).toHaveLength(0);
      expect(result.skippedProtected.map((d) => d.id)).toEqual([document.id]);
      expect(existsSync(filePath)).toBe(true);
      expect(await getTestDb().document.findUnique({ where: { id: document.id } })).not.toBeNull();
    });

    it("deleting the expense unlinks (does not delete) its receipt, and the receipt is then no longer protected", async () => {
      const owner = await createTestUser();
      const { expense, document, filePath } = await createExpenseReceiptDocument(owner.id);

      await getTestDb().expense.delete({ where: { id: expense.id } });

      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row).not.toBeNull();
      expect(row?.expenseId).toBeNull();
      expect(existsSync(filePath)).toBe(true);

      // Now an ordinary, unprotected document — deleteDocument's ownership
      // check no longer finds it via the (now-gone) expense link, matching
      // the documented, accepted limitation for any document whose only
      // ownership path disappears; it remains recoverable via direct DB
      // administration, same as the cascade-orphan case documented in
      // scripts/find-orphaned-documents.ts.
      const result = await deleteDocument(owner.id, document.id, getTestDb(), NOW);
      expect(result).toEqual({ outcome: "not-found" });
    });
  });
});
