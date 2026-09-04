"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { getStorageAdapter } from "@/lib/storage";
import { deleteDocument, documentOwnershipFilter, restoreDocument } from "@/lib/documents/mutations";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  isAllowedDocumentMimeType,
} from "@/lib/documents/validation";

const DOCUMENT_TYPES = [
  "CONTRACT",
  "DISCLOSURE",
  "ADDENDUM",
  "INSPECTION_REPORT",
  "APPRAISAL",
  "TITLE_DOCUMENT",
  "CLOSING_STATEMENT",
  "OTHER",
] as const;

export interface UploadDocumentState {
  error?: string;
}

export async function uploadDocumentAction(
  _prevState: UploadDocumentState | undefined,
  formData: FormData,
): Promise<UploadDocumentState> {
  const session = await requireSession();

  const transactionId = formData.get("transactionId");
  const documentType = formData.get("documentType");
  const description = formData.get("description");
  const file = formData.get("file");

  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction." };
  }

  const typeParsed = z.enum(DOCUMENT_TYPES).safeParse(documentType);
  if (!typeParsed.success) {
    return { error: "Choose a document type." };
  }

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { error: "That file is too large. The maximum size is 15 MB." };
  }
  if (!isAllowedDocumentMimeType(file.type)) {
    return {
      error: "That file type isn't supported. Upload a PDF, Word document, or image.",
    };
  }

  // Never trust a transaction id from the browser: it must belong to the
  // signed-in user, or nothing is uploaded.
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, ownerId: session.user.id },
  });
  if (!transaction) {
    return { error: "That transaction could not be found." };
  }

  const extension = ALLOWED_DOCUMENT_MIME_TYPES[file.type] ?? "";
  const key = `transactions/${transaction.id}/${randomUUID()}${extension}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getStorageAdapter().put({ key, body, contentType: file.type });

  await prisma.document.create({
    data: {
      filename: file.name,
      documentType: typeParsed.data,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      storagePath: key,
      fileSize: file.size,
      mimeType: file.type,
      transactionId: transaction.id,
      contactId: transaction.contactId,
      uploadedByUserId: session.user.id,
    },
  });

  revalidatePath(`/transactions/${transaction.id}`);
  return {};
}

export async function archiveDocumentAction(formData: FormData) {
  const session = await requireSession();

  const documentId = formData.get("documentId");
  if (typeof documentId !== "string") return;

  const document = await prisma.document.findFirst({
    where: { id: documentId, ...documentOwnershipFilter(session.user.id) },
  });
  if (!document) return;

  await prisma.document.update({ where: { id: document.id }, data: { status: "ARCHIVED" } });

  if (document.transactionId) revalidatePath(`/transactions/${document.transactionId}`);
}

/**
 * Soft-deletes a document — unlike archive above (which only flips a
 * status flag), this starts the 45-day permanent-deletion countdown, but
 * the file itself is untouched in storage until
 * scripts/cleanup-expired-documents.ts actually removes it, days later.
 * The owner-scoped, protection-checked logic lives in
 * src/lib/documents/mutations.ts so it's independently testable against
 * the dedicated test database. A protected document (e.g. one with
 * contract information built from it) isn't scheduled for deletion at
 * all; nothing here surfaces that as a form error today (this is a
 * fire-and-forget action, matching archiveDocumentAction's shape above),
 * but the document itself is simply left alone either way.
 */
export async function deleteDocumentAction(formData: FormData) {
  const session = await requireSession();

  const documentId = formData.get("documentId");
  if (typeof documentId !== "string") return;

  const result = await deleteDocument(session.user.id, documentId);
  if (result.outcome !== "pending-deletion") return;

  revalidatePath("/documents");
  if (result.transactionId) revalidatePath(`/transactions/${result.transactionId}`);
}

/**
 * Cancels a pending deletion and returns the document to UPLOADED. Never
 * touches storage — soft delete never did either. Safe to submit more
 * than once: a document that isn't (or is no longer) pending deletion
 * simply isn't matched, so a repeat submission is a silent no-op, the
 * same convention every other fire-and-forget action here already uses.
 */
export async function restoreDocumentAction(formData: FormData) {
  const session = await requireSession();

  const documentId = formData.get("documentId");
  if (typeof documentId !== "string") return;

  const result = await restoreDocument(session.user.id, documentId);
  if (result.outcome !== "restored") return;

  revalidatePath("/documents");
  if (result.transactionId) revalidatePath(`/transactions/${result.transactionId}`);
}
