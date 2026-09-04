import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { DeductibilityStatus, PaymentMethod } from "@/generated/prisma/enums";
import { checkDocumentDeletionProtection, markDocumentPendingDeletion } from "@/lib/documents/mutations";
import { getStorageAdapter, type StorageAdapter } from "@/lib/storage";
import { ALLOWED_DOCUMENT_MIME_TYPES, isAllowedDocumentMimeType, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/validation";

/**
 * Tax & Expense tracking: record-keeping mutations, not a tax engine.
 * Nothing here infers deductibleStatus (always exactly what the caller
 * passes — never defaulted to DEDUCTIBLE by this module) or defaults
 * businessUsePercent to 100. Same shape as src/lib/contacts/mutations.ts
 * and src/lib/documents/mutations.ts: no `import "server-only"`, optional
 * trailing Prisma-client overrides for direct testability against the
 * dedicated test database.
 */

/** Derives the calendar-year bucket a date-only field falls into, using this schema's established UTC-date convention (see src/lib/format.ts) — not the server's local time zone. */
export function deriveTaxYear(date: Date): number {
  return date.getUTCFullYear();
}

interface OptionalAssociations {
  transactionId?: string;
  contactId?: string;
}

/**
 * Every non-empty association id must belong to the same user — never
 * trust an id from a form directly. transactionId/contactId are
 * form-driven (create/update always write both, even to clear them —
 * see createExpense/updateExpense below).
 */
async function associationsBelongToUser(
  db: Prisma.TransactionClient,
  userId: string,
  { transactionId, contactId }: OptionalAssociations,
): Promise<boolean> {
  if (transactionId) {
    const found = await db.transaction.findFirst({ where: { id: transactionId, ownerId: userId }, select: { id: true } });
    if (!found) return false;
  }
  if (contactId) {
    const found = await db.contact.findFirst({ where: { id: contactId, ownerId: userId }, select: { id: true } });
    if (!found) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface ExpenseInput extends OptionalAssociations {
  expenseDate: Date;
  amount: string;
  vendor: string;
  categoryId: string;
  businessPurpose?: string;
  paymentMethod: PaymentMethod;
  deductibleStatus: DeductibilityStatus;
  businessUsePercent?: number;
  notes?: string;
}

export type CreateExpenseResult =
  | { outcome: "created"; expenseId: string }
  | { outcome: "invalid-association" }
  | { outcome: "invalid-category" };

export async function createExpense(
  userId: string,
  input: ExpenseInput,
  db: Prisma.TransactionClient = prisma,
): Promise<CreateExpenseResult> {
  if (!(await associationsBelongToUser(db, userId, input))) {
    return { outcome: "invalid-association" };
  }
  const category = await db.expenseCategory.findFirst({
    where: { id: input.categoryId, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true },
  });
  if (!category) return { outcome: "invalid-category" };

  const expense = await db.expense.create({
    data: {
      ownerId: userId,
      expenseDate: input.expenseDate,
      taxYear: deriveTaxYear(input.expenseDate),
      amount: input.amount,
      vendor: input.vendor,
      categoryId: input.categoryId,
      businessPurpose: input.businessPurpose ?? null,
      paymentMethod: input.paymentMethod,
      deductibleStatus: input.deductibleStatus,
      businessUsePercent: input.businessUsePercent ?? null,
      notes: input.notes ?? null,
      transactionId: input.transactionId ?? null,
      contactId: input.contactId ?? null,
    },
  });

  return { outcome: "created", expenseId: expense.id };
}

export type UpdateExpenseResult =
  | { outcome: "updated" }
  | { outcome: "not-found" }
  | { outcome: "invalid-association" }
  | { outcome: "invalid-category" };

export async function updateExpense(
  userId: string,
  expenseId: string,
  input: ExpenseInput,
  db: Prisma.TransactionClient = prisma,
): Promise<UpdateExpenseResult> {
  const existing = await db.expense.findFirst({ where: { id: expenseId, ownerId: userId }, select: { id: true } });
  if (!existing) return { outcome: "not-found" };

  if (!(await associationsBelongToUser(db, userId, input))) {
    return { outcome: "invalid-association" };
  }
  const category = await db.expenseCategory.findFirst({
    where: { id: input.categoryId, OR: [{ ownerId: null }, { ownerId: userId }] },
    select: { id: true },
  });
  if (!category) return { outcome: "invalid-category" };

  await db.expense.update({
    where: { id: existing.id },
    data: {
      expenseDate: input.expenseDate,
      taxYear: deriveTaxYear(input.expenseDate),
      amount: input.amount,
      vendor: input.vendor,
      categoryId: input.categoryId,
      businessPurpose: input.businessPurpose ?? null,
      paymentMethod: input.paymentMethod,
      deductibleStatus: input.deductibleStatus,
      businessUsePercent: input.businessUsePercent ?? null,
      notes: input.notes ?? null,
      transactionId: input.transactionId ?? null,
      contactId: input.contactId ?? null,
    },
  });

  return { outcome: "updated" };
}

export type DeleteExpenseResult = { outcome: "deleted" } | { outcome: "not-found" };

/**
 * Deletes the Expense row only. Any attached receipts are never touched
 * here at all — Document.expenseId is declared onDelete: SetNull (see its
 * schema comment), so Postgres itself un-links them the moment this row
 * disappears; they survive as ordinary documents, and the document
 * lifecycle (deleteDocument/cleanupExpiredDocuments) remains the only
 * code path that ever deletes the underlying R2 object.
 */
export async function deleteExpense(
  userId: string,
  expenseId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<DeleteExpenseResult> {
  const expense = await db.expense.findFirst({ where: { id: expenseId, ownerId: userId }, select: { id: true } });
  if (!expense) return { outcome: "not-found" };

  await db.expense.delete({ where: { id: expense.id } });

  return { outcome: "deleted" };
}

// ---------------------------------------------------------------------------
// Mileage
// ---------------------------------------------------------------------------

export interface MileageInput extends OptionalAssociations {
  date: Date;
  startLocation: string;
  destination: string;
  businessPurpose: string;
  miles: string;
  notes?: string;
}

export type CreateMileageResult = { outcome: "created"; mileageRecordId: string } | { outcome: "invalid-association" };

export async function createMileageRecord(
  userId: string,
  input: MileageInput,
  db: Prisma.TransactionClient = prisma,
): Promise<CreateMileageResult> {
  if (!(await associationsBelongToUser(db, userId, input))) {
    return { outcome: "invalid-association" };
  }

  const record = await db.mileageRecord.create({
    data: {
      ownerId: userId,
      date: input.date,
      taxYear: deriveTaxYear(input.date),
      startLocation: input.startLocation,
      destination: input.destination,
      businessPurpose: input.businessPurpose,
      miles: input.miles,
      notes: input.notes ?? null,
      transactionId: input.transactionId ?? null,
      contactId: input.contactId ?? null,
    },
  });

  return { outcome: "created", mileageRecordId: record.id };
}

export type UpdateMileageResult = { outcome: "updated" } | { outcome: "not-found" } | { outcome: "invalid-association" };

export async function updateMileageRecord(
  userId: string,
  mileageRecordId: string,
  input: MileageInput,
  db: Prisma.TransactionClient = prisma,
): Promise<UpdateMileageResult> {
  const existing = await db.mileageRecord.findFirst({ where: { id: mileageRecordId, ownerId: userId }, select: { id: true } });
  if (!existing) return { outcome: "not-found" };

  if (!(await associationsBelongToUser(db, userId, input))) {
    return { outcome: "invalid-association" };
  }

  await db.mileageRecord.update({
    where: { id: existing.id },
    data: {
      date: input.date,
      taxYear: deriveTaxYear(input.date),
      startLocation: input.startLocation,
      destination: input.destination,
      businessPurpose: input.businessPurpose,
      miles: input.miles,
      notes: input.notes ?? null,
      transactionId: input.transactionId ?? null,
      contactId: input.contactId ?? null,
    },
  });

  return { outcome: "updated" };
}

export type DeleteMileageResult = { outcome: "deleted" } | { outcome: "not-found" };

export async function deleteMileageRecord(
  userId: string,
  mileageRecordId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<DeleteMileageResult> {
  const record = await db.mileageRecord.findFirst({ where: { id: mileageRecordId, ownerId: userId }, select: { id: true } });
  if (!record) return { outcome: "not-found" };

  await db.mileageRecord.delete({ where: { id: record.id } });

  return { outcome: "deleted" };
}

// ---------------------------------------------------------------------------
// Receipts (reuses the existing Document/StorageAdapter/R2 stack — see
// prisma/schema.prisma's Document.expenseId comment. No second file-
// storage system; the only new thing here is the expenseId link.)
// ---------------------------------------------------------------------------

interface UploadableFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type AttachExpenseReceiptResult =
  | { outcome: "attached"; documentId: string }
  | { outcome: "not-found" }
  | { outcome: "invalid-file" };

export async function attachExpenseReceipt(
  userId: string,
  expenseId: string,
  file: UploadableFile,
  db: Prisma.TransactionClient = prisma,
  storage: StorageAdapter = getStorageAdapter(),
): Promise<AttachExpenseReceiptResult> {
  const expense = await db.expense.findFirst({ where: { id: expenseId, ownerId: userId }, select: { id: true } });
  if (!expense) return { outcome: "not-found" };

  if (file.size === 0 || file.size > MAX_DOCUMENT_SIZE_BYTES || !isAllowedDocumentMimeType(file.type)) {
    return { outcome: "invalid-file" };
  }

  const extension = ALLOWED_DOCUMENT_MIME_TYPES[file.type] ?? "";
  const key = `expenses/${expense.id}/${randomUUID()}${extension}`;
  const body = Buffer.from(await file.arrayBuffer());
  await storage.put({ key, body, contentType: file.type });

  const document = await db.document.create({
    data: {
      filename: file.name,
      documentType: "RECEIPT",
      storagePath: key,
      fileSize: file.size,
      mimeType: file.type,
      uploadedByUserId: userId,
      expenseId: expense.id,
    },
  });

  return { outcome: "attached", documentId: document.id };
}

export type RemoveExpenseReceiptResult =
  | { outcome: "removed"; transactionId: string | null }
  | { outcome: "not-found" }
  | { outcome: "still-protected"; reason: string };

/**
 * The one authorized way to detach a receipt from an expense. Ownership
 * is established through the Expense (not the document's own transitive
 * links, which may be nothing else at all for a general, non-transaction
 * expense's receipt) — this action itself IS the removal of the
 * expenseId link that would otherwise make checkDocumentDeletionProtection
 * refuse to touch it, so it unlinks first, then re-checks protection
 * (catching the rare case where the same document is also protected by
 * something else, e.g. ContractInformation, which still applies), then
 * defers to the same soft-delete write deleteDocument uses — the document
 * lifecycle remains the only path that will ever physically delete the R2
 * object, days later, if at all.
 */
export async function removeExpenseReceipt(
  userId: string,
  expenseId: string,
  documentId: string,
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<RemoveExpenseReceiptResult> {
  const expense = await db.expense.findFirst({ where: { id: expenseId, ownerId: userId }, select: { id: true } });
  if (!expense) return { outcome: "not-found" };

  const document = await db.document.findFirst({ where: { id: documentId, expenseId: expense.id } });
  if (!document) return { outcome: "not-found" };

  await db.document.update({ where: { id: document.id }, data: { expenseId: null } });

  const protection = await checkDocumentDeletionProtection(db, { id: document.id, expenseId: null });
  if (protection.protected) {
    // Unlinked from this expense (done, correct), but something else
    // still protects it — leave it as an ordinary, no-longer-attached
    // document rather than soft-deleting it.
    return { outcome: "still-protected", reason: protection.reason! };
  }

  await markDocumentPendingDeletion(db, document, userId, now);

  return { outcome: "removed", transactionId: document.transactionId };
}
