"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { isAllowedDocumentMimeType, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/validation";
import { createExpenseSchema, createMileageSchema, type CreateExpenseInput, type CreateMileageInput } from "@/lib/tax-expenses/validation";
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
  type ExpenseInput,
  type MileageInput,
} from "@/lib/tax-expenses/mutations";

// Record-keeping only, same reminder as every other file in this
// directory: nothing here infers deductibility or defaults business-use
// percentage — every value written comes directly from what the user
// submitted.

function toExpenseInput(parsed: CreateExpenseInput): ExpenseInput {
  return {
    expenseDate: parsed.expenseDate,
    amount: parsed.amount,
    vendor: parsed.vendor,
    categoryId: parsed.categoryId,
    businessPurpose: parsed.businessPurpose,
    paymentMethod: parsed.paymentMethod,
    deductibleStatus: parsed.deductibleStatus,
    businessUsePercent: parsed.businessUsePercent,
    notes: parsed.notes,
    transactionId: parsed.transactionId,
    contactId: parsed.contactId,
  };
}

function toMileageInput(parsed: CreateMileageInput): MileageInput {
  return {
    date: parsed.date,
    startLocation: parsed.startLocation,
    destination: parsed.destination,
    businessPurpose: parsed.businessPurpose,
    miles: parsed.miles,
    notes: parsed.notes,
    transactionId: parsed.transactionId,
    contactId: parsed.contactId,
  };
}

export interface ExpenseFormState {
  error?: string;
}

/**
 * Creates an expense and, if a receipt file was included in the same
 * submission, attaches it in the same action — matching
 * uploadDocumentAction's established single-action-with-file pattern.
 * The file (if any) is validated *before* the expense row is created, so
 * an invalid receipt never leaves a half-created expense behind.
 */
export async function createExpenseAction(
  _prevState: ExpenseFormState | undefined,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await requireSession();

  const parsed = createExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const file = formData.get("receipt");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) return { error: "That receipt is too large. The maximum size is 15 MB." };
    if (!isAllowedDocumentMimeType(file.type)) {
      return { error: "That receipt's file type isn't supported. Upload a PDF, Word document, or image." };
    }
  }

  const result = await createExpense(session.user.id, toExpenseInput(parsed.data));
  if (result.outcome === "invalid-association") {
    return { error: "That transaction, client, or contact could not be found." };
  }
  if (result.outcome === "invalid-category") {
    return { error: "Choose a valid category." };
  }

  if (hasFile) {
    await attachExpenseReceipt(session.user.id, result.expenseId, file);
  }

  revalidatePath("/tax-expenses");
  revalidatePath("/reports");
  redirect(`/tax-expenses/${result.expenseId}/edit`);
}

export async function updateExpenseAction(
  _prevState: ExpenseFormState | undefined,
  formData: FormData,
): Promise<ExpenseFormState> {
  const session = await requireSession();

  const expenseId = formData.get("expenseId");
  if (typeof expenseId !== "string") return { error: "Missing expense." };

  const parsed = createExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await updateExpense(session.user.id, expenseId, toExpenseInput(parsed.data));
  if (result.outcome === "not-found") return { error: "That expense could not be found." };
  if (result.outcome === "invalid-association") return { error: "That transaction, client, or contact could not be found." };
  if (result.outcome === "invalid-category") return { error: "Choose a valid category." };

  revalidatePath("/tax-expenses");
  revalidatePath(`/tax-expenses/${expenseId}`);
  revalidatePath(`/tax-expenses/${expenseId}/edit`);
  revalidatePath("/reports");
  redirect(`/tax-expenses/${expenseId}`);
}

const duplicateExpenseSchema = z.object({
  expenseId: z.string().min(1),
  expenseDate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .transform((value) => new Date(value)),
});

export interface DuplicateExpenseState {
  error?: string;
}

/**
 * Copies an existing expense onto a new date the agent picks on the
 * duplicate-confirmation page — see duplicateExpense (mutations.ts) for
 * what is and isn't copied. Never touches the original expense.
 */
export async function duplicateExpenseAction(
  _prevState: DuplicateExpenseState | undefined,
  formData: FormData,
): Promise<DuplicateExpenseState> {
  const session = await requireSession();

  const parsed = duplicateExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await duplicateExpense(session.user.id, parsed.data.expenseId, parsed.data.expenseDate);
  if (result.outcome === "not-found") return { error: "That expense could not be found." };

  revalidatePath("/tax-expenses");
  revalidatePath("/reports");
  redirect(`/tax-expenses/${result.expenseId}`);
}

export interface DeleteExpenseState {
  error?: string;
}

/**
 * useActionState-shaped (matching deleteContactAction) so the expense
 * detail page can use the shared DeleteButton component — confirm dialog
 * plus an error message if deletion is ever blocked. Deleting an expense
 * never touches its receipt's R2 object — see deleteExpense's own comment
 * (src/lib/tax-expenses/mutations.ts).
 */
export async function deleteExpenseAction(
  _prevState: DeleteExpenseState | undefined,
  formData: FormData,
): Promise<DeleteExpenseState> {
  const session = await requireSession();

  const expenseId = formData.get("expenseId");
  if (typeof expenseId !== "string") return { error: "Missing expense." };

  const result = await deleteExpense(session.user.id, expenseId);
  if (result.outcome !== "deleted") return { error: "That expense could not be found." };

  revalidatePath("/tax-expenses");
  revalidatePath("/reports");
  redirect("/tax-expenses");
}

export interface AttachReceiptState {
  error?: string;
}

export async function attachExpenseReceiptAction(
  _prevState: AttachReceiptState | undefined,
  formData: FormData,
): Promise<AttachReceiptState> {
  const session = await requireSession();

  const expenseId = formData.get("expenseId");
  const file = formData.get("receipt");
  if (typeof expenseId !== "string") return { error: "Missing expense." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };

  const result = await attachExpenseReceipt(session.user.id, expenseId, file);
  if (result.outcome === "not-found") return { error: "That expense could not be found." };
  if (result.outcome === "invalid-file") {
    return { error: "That file type isn't supported, or it's too large (max 15 MB)." };
  }

  revalidatePath(`/tax-expenses/${expenseId}/edit`);
  return {};
}

/**
 * Detaches (and soft-deletes, per the document lifecycle) a receipt from
 * an expense — the one authorized way to remove one. Fire-and-forget,
 * matching every other document-adjacent action in this codebase; a
 * "still-protected" outcome (e.g. the same document also has
 * ContractInformation, vanishingly rare in practice) simply leaves the
 * unlinked-but-undeleted document alone rather than surfacing a form error.
 */
export async function removeExpenseReceiptAction(formData: FormData) {
  const session = await requireSession();

  const expenseId = formData.get("expenseId");
  const documentId = formData.get("documentId");
  if (typeof expenseId !== "string" || typeof documentId !== "string") return;

  const result = await removeExpenseReceipt(session.user.id, expenseId, documentId);
  if (result.outcome === "not-found") return;

  revalidatePath(`/tax-expenses/${expenseId}/edit`);
}

export interface MileageFormState {
  error?: string;
}

export async function createMileageAction(
  _prevState: MileageFormState | undefined,
  formData: FormData,
): Promise<MileageFormState> {
  const session = await requireSession();

  const parsed = createMileageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await createMileageRecord(session.user.id, toMileageInput(parsed.data));
  if (result.outcome === "invalid-association") {
    return { error: "That transaction, client, or contact could not be found." };
  }

  revalidatePath("/tax-expenses/mileage");
  redirect("/tax-expenses/mileage");
}

export async function updateMileageAction(
  _prevState: MileageFormState | undefined,
  formData: FormData,
): Promise<MileageFormState> {
  const session = await requireSession();

  const mileageRecordId = formData.get("mileageRecordId");
  if (typeof mileageRecordId !== "string") return { error: "Missing mileage record." };

  const parsed = createMileageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const result = await updateMileageRecord(session.user.id, mileageRecordId, toMileageInput(parsed.data));
  if (result.outcome === "not-found") return { error: "That mileage record could not be found." };
  if (result.outcome === "invalid-association") return { error: "That transaction, client, or contact could not be found." };

  revalidatePath("/tax-expenses/mileage");
  redirect("/tax-expenses/mileage");
}

export async function deleteMileageAction(formData: FormData) {
  const session = await requireSession();

  const mileageRecordId = formData.get("mileageRecordId");
  if (typeof mileageRecordId !== "string") return;

  const result = await deleteMileageRecord(session.user.id, mileageRecordId);
  if (result.outcome !== "deleted") return;

  revalidatePath("/tax-expenses/mileage");
}
