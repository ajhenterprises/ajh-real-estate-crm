"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { getStorageAdapter } from "@/lib/storage";
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
      clientId: transaction.clientId,
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
    where: {
      id: documentId,
      OR: [
        { transaction: { ownerId: session.user.id } },
        { client: { ownerId: session.user.id } },
        { contact: { ownerId: session.user.id } },
      ],
    },
  });
  if (!document) return;

  await prisma.document.update({ where: { id: document.id }, data: { status: "ARCHIVED" } });

  if (document.transactionId) revalidatePath(`/transactions/${document.transactionId}`);
}
