import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { LocalFilesystemStorageAdapter } from "@/lib/storage/local";
import type { StorageAdapter } from "@/lib/storage";
import { deleteDocument } from "@/lib/documents/mutations";

/**
 * Integration tests for the Phase 8 document-deletion vehicle, run against
 * the dedicated test database (see src/test/db.ts) plus a real, throwaway
 * on-disk storage root — not a mocked filesystem — so the file-first,
 * DB-row-second ordering and ENOENT handling are exercised for real.
 */
describe.skipIf(!hasTestDatabase)("deleteDocument (integration)", () => {
  let storageRoot: string;
  let storage: StorageAdapter;

  beforeEach(async () => {
    await resetTestDatabase();
    storageRoot = await mkdtemp(path.join(tmpdir(), "ajh-crm-doc-delete-test-"));
    storage = new LocalFilesystemStorageAdapter(storageRoot);
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function createOwnedDocument(ownerId: string) {
    const db = getTestDb();
    const contact = await createTestContact(ownerId);
    const key = `contacts/${contact.id}/${Math.random().toString(36).slice(2)}.pdf`;
    const filePath = path.join(storageRoot, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "fake pdf bytes");

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

  it("deletes the file and the database row for the owning user", async () => {
    const owner = await createTestUser();
    const { document, filePath } = await createOwnedDocument(owner.id);

    const result = await deleteDocument(owner.id, document.id, getTestDb(), storage);

    expect(result).toEqual({ outcome: "deleted", transactionId: null });
    expect(existsSync(filePath)).toBe(false);
    const row = await getTestDb().document.findUnique({ where: { id: document.id } });
    expect(row).toBeNull();
  });

  it("rejects deletion by a user who does not own the document, leaving row and file untouched", async () => {
    const owner = await createTestUser();
    const otherUser = await createTestUser();
    const { document, filePath } = await createOwnedDocument(owner.id);

    const result = await deleteDocument(otherUser.id, document.id, getTestDb(), storage);

    expect(result).toEqual({ outcome: "not-found" });
    expect(existsSync(filePath)).toBe(true);
    const row = await getTestDb().document.findUnique({ where: { id: document.id } });
    expect(row).not.toBeNull();
    const bytesOnDisk = await readFile(filePath, "utf8");
    expect(bytesOnDisk).toBe("fake pdf bytes");
  });

  it("reports not-found for a document id that does not exist", async () => {
    const owner = await createTestUser();

    const result = await deleteDocument(owner.id, "nonexistent-document-id", getTestDb(), storage);

    expect(result).toEqual({ outcome: "not-found" });
  });

  it("treats an already-missing file (ENOENT) as already-deleted and still removes the row", async () => {
    const owner = await createTestUser();
    const { document, filePath } = await createOwnedDocument(owner.id);
    // Simulate the file having gone missing out-of-band (e.g. a prior
    // partial failure, or manual intervention) before deleteDocument runs.
    await rm(filePath);

    const result = await deleteDocument(owner.id, document.id, getTestDb(), storage);

    expect(result).toEqual({ outcome: "deleted", transactionId: null });
    const row = await getTestDb().document.findUnique({ where: { id: document.id } });
    expect(row).toBeNull();
  });

  it("aborts before touching the row when storage deletion fails with a non-ENOENT error", async () => {
    const owner = await createTestUser();
    const { document, filePath } = await createOwnedDocument(owner.id);
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

    const result = await deleteDocument(owner.id, document.id, getTestDb(), failingStorage);

    expect(result.outcome).toBe("storage-error");
    // Both sides of the system are left consistent with each other: the row
    // is still there, and so is the file it points at.
    const row = await getTestDb().document.findUnique({ where: { id: document.id } });
    expect(row).not.toBeNull();
    expect(existsSync(filePath)).toBe(true);
  });

  it("is idempotent: a second deletion of the same document reports not-found rather than erroring", async () => {
    const owner = await createTestUser();
    const { document } = await createOwnedDocument(owner.id);

    const first = await deleteDocument(owner.id, document.id, getTestDb(), storage);
    const second = await deleteDocument(owner.id, document.id, getTestDb(), storage);

    expect(first.outcome).toBe("deleted");
    expect(second).toEqual({ outcome: "not-found" });
  });

  describe("deletion protection (ContractInformation)", () => {
    async function createContractDocumentWithInformation(ownerId: string) {
      const db = getTestDb();
      const contact = await createTestContact(ownerId);
      const client = await db.client.create({ data: { contactId: contact.id, ownerId, type: "BUYER" } });
      const transaction = await db.transaction.create({ data: { clientId: client.id, ownerId, type: "BUYER" } });

      const key = `transactions/${transaction.id}/contract.pdf`;
      const filePath = path.join(storageRoot, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "contract bytes");

      const document = await db.document.create({
        data: {
          filename: "contract.pdf",
          documentType: "CONTRACT",
          storagePath: key,
          fileSize: 14,
          mimeType: "application/pdf",
          uploadedByUserId: ownerId,
          transactionId: transaction.id,
        },
      });
      await db.contractInformation.create({
        data: { transactionId: transaction.id, documentId: document.id, ownerId },
      });

      return { document, filePath };
    }

    it("refuses to delete a document with ContractInformation built from it, leaving the file and row untouched", async () => {
      // Regression test: this reproduces a real bug found while auditing
      // deletion/retention design for future document-carrying features
      // (see prisma/schema.prisma's Document model comment). Before this
      // fix, deleteDocument deleted the file first and only then hit
      // Postgres's onDelete: Restrict constraint on document.delete(),
      // which threw — leaving the file permanently gone but the row
      // (uselessly) still present. The fix checks for this relation
      // before ever touching storage.
      const owner = await createTestUser();
      const { document, filePath } = await createContractDocumentWithInformation(owner.id);

      const result = await deleteDocument(owner.id, document.id, getTestDb(), storage);

      expect(result.outcome).toBe("protected");
      expect(existsSync(filePath)).toBe(true);
      const bytesOnDisk = await readFile(filePath, "utf8");
      expect(bytesOnDisk).toBe("contract bytes");
      const row = await getTestDb().document.findUnique({ where: { id: document.id } });
      expect(row).not.toBeNull();
    });

    it("still deletes an ordinary CONTRACT document that has no ContractInformation row", async () => {
      const owner = await createTestUser();
      const db = getTestDb();
      const contact = await createTestContact(owner.id);
      const client = await db.client.create({ data: { contactId: contact.id, ownerId: owner.id, type: "BUYER" } });
      const transaction = await db.transaction.create({
        data: { clientId: client.id, ownerId: owner.id, type: "BUYER" },
      });
      const key = `transactions/${transaction.id}/draft-contract.pdf`;
      const filePath = path.join(storageRoot, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, "draft bytes");
      const document = await db.document.create({
        data: {
          filename: "draft-contract.pdf",
          documentType: "CONTRACT",
          storagePath: key,
          fileSize: 12,
          mimeType: "application/pdf",
          uploadedByUserId: owner.id,
          transactionId: transaction.id,
        },
      });

      const result = await deleteDocument(owner.id, document.id, getTestDb(), storage);

      expect(result).toEqual({ outcome: "deleted", transactionId: transaction.id });
      expect(existsSync(filePath)).toBe(false);
    });
  });
});
