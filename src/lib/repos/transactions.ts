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
              { contact: { firstName: { contains: search, mode: "insensitive" } } },
              { contact: { lastName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      contact: true,
      events: { where: { status: "PENDING" }, orderBy: { date: "asc" }, take: 1 },
    },
  });
}

export function getTransactionById(userId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: { id: transactionId, ownerId: userId },
    include: {
      contact: true,
      events: { orderBy: { date: "asc" } },
      // createdAt/id order (not status/dueDate) so checklist tasks group by
      // category in the same order they were generated from templates —
      // createMany assigns cuids sequentially, so id is a reliable
      // tiebreaker when a whole checklist shares one createdAt instant.
      tasks: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { transactionEvent: { select: { title: true } } },
      },
      documents: {
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedByUser: { select: { name: true } },
          contractInformation: { select: { id: true, confirmedAt: true } },
        },
      },
    },
  });
}

export function getTransactionEventById(userId: string, eventId: string) {
  return prisma.transactionEvent.findFirst({
    where: { id: eventId, transaction: { ownerId: userId } },
  });
}

/** Owner-scoped existence + ownership check, used before nesting a create under a contact. */
export function getOwnedContact(userId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, ownerId: userId },
  });
}
