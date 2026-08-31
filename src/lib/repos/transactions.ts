import "server-only";
import { prisma } from "@/lib/db";
import type { TransactionStatus, TransactionType } from "@/generated/prisma/enums";

export interface TransactionListFilters {
  search?: string;
  status?: TransactionStatus;
  type?: TransactionType;
}

// Scoped to `ownerId` for the current session user — every filter is
// additive on top of that, never a substitute for it.
export function listTransactions(userId: string, filters: TransactionListFilters = {}) {
  const { search, status, type } = filters;

  return prisma.transaction.findMany({
    where: {
      ownerId: userId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            OR: [
              { propertyAddress: { contains: search, mode: "insensitive" } },
              { mlsNumber: { contains: search, mode: "insensitive" } },
              { client: { contact: { firstName: { contains: search, mode: "insensitive" } } } },
              { client: { contact: { lastName: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { include: { contact: true } },
      events: { where: { status: "PENDING" }, orderBy: { date: "asc" }, take: 1 },
    },
  });
}

export function getTransactionById(userId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: { id: transactionId, ownerId: userId },
    include: {
      client: { include: { contact: true } },
      events: { orderBy: { date: "asc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
}

/** Owner-scoped existence + ownership check, used before nesting a create under a client. */
export function getOwnedClient(userId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, ownerId: userId },
    include: { contact: true },
  });
}
