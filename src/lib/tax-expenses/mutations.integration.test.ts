import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { LocalFilesystemStorageAdapter } from "@/lib/storage/local";
import {
  attachExpenseReceipt,
  createExpense,
  createMileageRecord,
  deleteExpense,
  deleteMileageRecord,
  duplicateExpense,
  removeExpenseReceipt,
  updateExpense,
  updateMileageRecord,
} from "@/lib/tax-expenses/mutations";

const OTHER_CATEGORY_ID = "expcat_other";

function fakeFile(name: string, type: string, contents: string) {
  const buffer = Buffer.from(contents, "utf8");
  return {
    name,
    type,
    size: buffer.byteLength,
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

function baseExpenseInput(overrides: Record<string, unknown> = {}) {
  return {
    expenseDate: new Date("2026-03-15T00:00:00.000Z"),
    amount: "79.99",
    vendor: "Acme Software",
    categoryId: OTHER_CATEGORY_ID,
    paymentMethod: "BUSINESS_CREDIT_CARD" as const,
    deductibleStatus: "NEEDS_REVIEW" as const,
    ...overrides,
  };
}

function baseMileageInput(overrides: Record<string, unknown> = {}) {
  return {
    date: new Date("2026-06-01T00:00:00.000Z"),
    startLocation: "Office",
    destination: "123 Main St",
    businessPurpose: "Showing",
    miles: "12.5",
    ...overrides,
  };
}

describe.skipIf(!hasTestDatabase)("tax-expenses mutations (integration)", () => {
  let storageRoot: string;
  let storage: LocalFilesystemStorageAdapter;

  beforeEach(async () => {
    await resetTestDatabase();
    storageRoot = await mkdtemp(path.join(tmpdir(), "ajh-crm-tax-expenses-test-"));
    storage = new LocalFilesystemStorageAdapter(storageRoot);
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("createExpense", () => {
    it("creates an expense owned by the user, deriving tax year from the expense date (UTC)", async () => {
      const owner = await createTestUser();

      const result = await createExpense(owner.id, baseExpenseInput(), getTestDb());

      expect(result.outcome).toBe("created");
      if (result.outcome !== "created") throw new Error("expected created");
      const row = await getTestDb().expense.findUnique({ where: { id: result.expenseId } });
      expect(row?.ownerId).toBe(owner.id);
      expect(row?.taxYear).toBe(2026);
      expect(row?.deductibleStatus).toBe("NEEDS_REVIEW");
      expect(row?.amount.toString()).toBe("79.99");
    });

    it("rejects a contact association that does not belong to the user", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const otherContact = await createTestContact(otherUser.id);

      const result = await createExpense(owner.id, baseExpenseInput({ contactId: otherContact.id }), getTestDb());

      expect(result).toEqual({ outcome: "invalid-association" });
    });

    it("rejects an unknown category id", async () => {
      const owner = await createTestUser();

      const result = await createExpense(owner.id, baseExpenseInput({ categoryId: "not-a-real-category" }), getTestDb());

      expect(result).toEqual({ outcome: "invalid-category" });
    });

    it("allows a custom category the user created themselves", async () => {
      const owner = await createTestUser();
      const category = await getTestDb().expenseCategory.create({ data: { name: "Custom Cat", ownerId: owner.id } });

      const result = await createExpense(owner.id, baseExpenseInput({ categoryId: category.id }), getTestDb());

      expect(result.outcome).toBe("created");
    });

    it("rejects another user's custom category", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const otherCategory = await getTestDb().expenseCategory.create({ data: { name: "Other's Cat", ownerId: otherUser.id } });

      const result = await createExpense(owner.id, baseExpenseInput({ categoryId: otherCategory.id }), getTestDb());

      expect(result).toEqual({ outcome: "invalid-category" });
    });
  });

  describe("updateExpense", () => {
    it("updates an owned expense, re-deriving tax year and applying the new status", async () => {
      const owner = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await updateExpense(
        owner.id,
        created.expenseId,
        baseExpenseInput({ expenseDate: new Date("2025-01-01T00:00:00.000Z"), deductibleStatus: "DEDUCTIBLE" }),
        getTestDb(),
      );

      expect(result).toEqual({ outcome: "updated" });
      const row = await getTestDb().expense.findUnique({ where: { id: created.expenseId } });
      expect(row?.taxYear).toBe(2025);
      expect(row?.deductibleStatus).toBe("DEDUCTIBLE");
    });

    it("rejects updating another user's expense, leaving it unchanged", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await updateExpense(otherUser.id, created.expenseId, baseExpenseInput({ vendor: "Hijacked" }), getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
      const row = await getTestDb().expense.findUnique({ where: { id: created.expenseId } });
      expect(row?.vendor).toBe("Acme Software");
    });
  });

  describe("duplicateExpense", () => {
    it("copies every field onto a new row with the given date, leaving the original untouched", async () => {
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);
      const created = await createExpense(
        owner.id,
        baseExpenseInput({ businessPurpose: "CRM subscription", notes: "Monthly", contactId: contact.id }),
        getTestDb(),
      );
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await duplicateExpense(owner.id, created.expenseId, new Date("2026-04-15T00:00:00.000Z"), getTestDb());

      expect(result.outcome).toBe("duplicated");
      if (result.outcome !== "duplicated") throw new Error("expected duplicated");
      expect(result.expenseId).not.toBe(created.expenseId);

      const duplicate = await getTestDb().expense.findUnique({ where: { id: result.expenseId } });
      expect(duplicate?.expenseDate.toISOString().slice(0, 10)).toBe("2026-04-15");
      expect(duplicate?.taxYear).toBe(2026);
      expect(duplicate?.vendor).toBe("Acme Software");
      expect(duplicate?.amount.toString()).toBe("79.99");
      expect(duplicate?.categoryId).toBe(OTHER_CATEGORY_ID);
      expect(duplicate?.businessPurpose).toBe("CRM subscription");
      expect(duplicate?.notes).toBe("Monthly");
      expect(duplicate?.contactId).toBe(contact.id);

      // Original is unchanged.
      const original = await getTestDb().expense.findUnique({ where: { id: created.expenseId } });
      expect(original?.expenseDate.toISOString().slice(0, 10)).toBe("2026-03-15");
    });

    it("does not copy receipts onto the duplicate", async () => {
      const owner = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");
      const attached = await attachExpenseReceipt(
        owner.id,
        created.expenseId,
        fakeFile("receipt.pdf", "application/pdf", "receipt bytes"),
        getTestDb(),
        storage,
      );
      if (attached.outcome !== "attached") throw new Error("setup failed");

      const result = await duplicateExpense(owner.id, created.expenseId, new Date("2026-04-15T00:00:00.000Z"), getTestDb());

      expect(result.outcome).toBe("duplicated");
      if (result.outcome !== "duplicated") throw new Error("expected duplicated");
      const documents = await getTestDb().document.findMany({ where: { expenseId: result.expenseId } });
      expect(documents).toHaveLength(0);
    });

    it("rejects duplicating another user's expense", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await duplicateExpense(otherUser.id, created.expenseId, new Date("2026-04-15T00:00:00.000Z"), getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
    });
  });

  describe("deleteExpense", () => {
    it("deletes an owned expense and does not touch its receipt's storage object", async () => {
      const owner = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");
      const attached = await attachExpenseReceipt(
        owner.id,
        created.expenseId,
        fakeFile("receipt.pdf", "application/pdf", "receipt bytes"),
        getTestDb(),
        storage,
      );
      if (attached.outcome !== "attached") throw new Error("setup failed");
      const docBefore = await getTestDb().document.findUnique({ where: { id: attached.documentId } });
      const filePath = path.join(storageRoot, docBefore!.storagePath);
      expect(existsSync(filePath)).toBe(true);

      const result = await deleteExpense(owner.id, created.expenseId, getTestDb());

      expect(result).toEqual({ outcome: "deleted" });
      expect(existsSync(filePath)).toBe(true);
      const docAfter = await getTestDb().document.findUnique({ where: { id: attached.documentId } });
      expect(docAfter).not.toBeNull();
      expect(docAfter?.expenseId).toBeNull();
      expect(docAfter?.status).toBe("UPLOADED");
    });

    it("rejects deleting another user's expense", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await deleteExpense(otherUser.id, created.expenseId, getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
      expect(await getTestDb().expense.findUnique({ where: { id: created.expenseId } })).not.toBeNull();
    });
  });

  describe("mileage", () => {
    it("creates a mileage record owned by the user, deriving tax year", async () => {
      const owner = await createTestUser();

      const result = await createMileageRecord(owner.id, baseMileageInput(), getTestDb());

      expect(result.outcome).toBe("created");
      if (result.outcome !== "created") throw new Error("expected created");
      const row = await getTestDb().mileageRecord.findUnique({ where: { id: result.mileageRecordId } });
      expect(row?.ownerId).toBe(owner.id);
      expect(row?.taxYear).toBe(2026);
      expect(row?.miles.toString()).toBe("12.5");
    });

    it("rejects an association that does not belong to the user", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const otherContact = await createTestContact(otherUser.id);

      const result = await createMileageRecord(owner.id, baseMileageInput({ contactId: otherContact.id }), getTestDb());

      expect(result).toEqual({ outcome: "invalid-association" });
    });

    it("updates an owned mileage record", async () => {
      const owner = await createTestUser();
      const created = await createMileageRecord(owner.id, baseMileageInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await updateMileageRecord(owner.id, created.mileageRecordId, baseMileageInput({ miles: "20.5" }), getTestDb());

      expect(result).toEqual({ outcome: "updated" });
      const row = await getTestDb().mileageRecord.findUnique({ where: { id: created.mileageRecordId } });
      expect(row?.miles.toString()).toBe("20.5");
    });

    it("rejects updating another user's mileage record", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createMileageRecord(owner.id, baseMileageInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await updateMileageRecord(otherUser.id, created.mileageRecordId, baseMileageInput(), getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
    });

    it("deletes an owned mileage record", async () => {
      const owner = await createTestUser();
      const created = await createMileageRecord(owner.id, baseMileageInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await deleteMileageRecord(owner.id, created.mileageRecordId, getTestDb());

      expect(result).toEqual({ outcome: "deleted" });
      expect(await getTestDb().mileageRecord.findUnique({ where: { id: created.mileageRecordId } })).toBeNull();
    });

    it("rejects deleting another user's mileage record", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createMileageRecord(owner.id, baseMileageInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await deleteMileageRecord(otherUser.id, created.mileageRecordId, getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
      expect(await getTestDb().mileageRecord.findUnique({ where: { id: created.mileageRecordId } })).not.toBeNull();
    });
  });

  describe("receipts", () => {
    it("attaches a receipt to an owned expense, reusing the Document/StorageAdapter stack", async () => {
      const owner = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await attachExpenseReceipt(
        owner.id,
        created.expenseId,
        fakeFile("receipt.pdf", "application/pdf", "receipt bytes"),
        getTestDb(),
        storage,
      );

      expect(result.outcome).toBe("attached");
      if (result.outcome !== "attached") throw new Error("expected attached");
      const doc = await getTestDb().document.findUnique({ where: { id: result.documentId } });
      expect(doc?.expenseId).toBe(created.expenseId);
      expect(doc?.documentType).toBe("RECEIPT");
      expect(doc?.storagePath.startsWith(`expenses/${created.expenseId}/`)).toBe(true);
      const bytes = await storage.get(doc!.storagePath);
      expect(bytes.toString("utf8")).toBe("receipt bytes");
    });

    it("rejects attaching a receipt to another user's expense", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await attachExpenseReceipt(
        otherUser.id,
        created.expenseId,
        fakeFile("receipt.pdf", "application/pdf", "x"),
        getTestDb(),
        storage,
      );

      expect(result).toEqual({ outcome: "not-found" });
    });

    it("rejects a disallowed file type without uploading anything", async () => {
      const owner = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");

      const result = await attachExpenseReceipt(
        owner.id,
        created.expenseId,
        fakeFile("script.exe", "application/x-msdownload", "x"),
        getTestDb(),
        storage,
      );

      expect(result).toEqual({ outcome: "invalid-file" });
      const docs = await getTestDb().document.findMany({ where: { expenseId: created.expenseId } });
      expect(docs).toHaveLength(0);
    });

    it("removes (soft-deletes) a receipt without touching the file yet", async () => {
      const owner = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");
      const attached = await attachExpenseReceipt(
        owner.id,
        created.expenseId,
        fakeFile("receipt.pdf", "application/pdf", "receipt bytes"),
        getTestDb(),
        storage,
      );
      if (attached.outcome !== "attached") throw new Error("setup failed");
      const docBefore = await getTestDb().document.findUnique({ where: { id: attached.documentId } });
      const filePath = path.join(storageRoot, docBefore!.storagePath);

      const result = await removeExpenseReceipt(owner.id, created.expenseId, attached.documentId, getTestDb());

      expect(result.outcome).toBe("removed");
      expect(existsSync(filePath)).toBe(true);
      const docAfter = await getTestDb().document.findUnique({ where: { id: attached.documentId } });
      expect(docAfter?.status).toBe("PENDING_DELETION");
      expect(docAfter?.expenseId).toBeNull();
    });

    it("rejects removing a receipt through another user's expense id", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const created = await createExpense(owner.id, baseExpenseInput(), getTestDb());
      if (created.outcome !== "created") throw new Error("setup failed");
      const attached = await attachExpenseReceipt(
        owner.id,
        created.expenseId,
        fakeFile("receipt.pdf", "application/pdf", "receipt bytes"),
        getTestDb(),
        storage,
      );
      if (attached.outcome !== "attached") throw new Error("setup failed");

      const result = await removeExpenseReceipt(otherUser.id, created.expenseId, attached.documentId, getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
      const doc = await getTestDb().document.findUnique({ where: { id: attached.documentId } });
      expect(doc?.status).toBe("UPLOADED");
    });
  });
});
