import "server-only";
import { prisma } from "@/lib/db";
import type { ClientStatus, ClientType, TransactionStatus } from "@/generated/prisma/enums";

const ACTIVE_TRANSACTION_STATUSES: TransactionStatus[] = ["PROSPECT", "ACTIVE", "UNDER_CONTRACT", "PENDING"];
const CLOSED_TRANSACTION_STATUSES: TransactionStatus[] = ["CLOSED", "CANCELLED"];

export type ClientSort = "name_asc" | "name_desc" | "created_desc" | "created_asc" | "updated_desc";

export interface ClientListFilters {
  search?: string;
  status?: ClientStatus;
  type?: ClientType;
  sort?: ClientSort;
}

function clientOrderBy(sort: ClientSort | undefined) {
  switch (sort) {
    case "name_asc":
      return [{ contact: { lastName: "asc" as const } }, { contact: { firstName: "asc" as const } }];
    case "name_desc":
      return [{ contact: { lastName: "desc" as const } }, { contact: { firstName: "desc" as const } }];
    case "created_asc":
      return [{ createdAt: "asc" as const }];
    case "updated_desc":
      return [{ updatedAt: "desc" as const }];
    case "created_desc":
    default:
      return [{ createdAt: "desc" as const }];
  }
}

// Scoped to `ownerId` for the current session user — every filter is
// additive on top of that, never a substitute for it.
export function listClients(userId: string, filters: ClientListFilters = {}) {
  const { search, status, type, sort } = filters;

  return prisma.client.findMany({
    where: {
      ownerId: userId,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(search
        ? {
            contact: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: clientOrderBy(sort),
    include: {
      contact: true,
      transactions: {
        select: { id: true, status: true, createdAt: true, propertyAddress: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export function getClientById(userId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, ownerId: userId },
    include: {
      contact: { include: { activities: { orderBy: { createdAt: "desc" }, take: 20 } } },
      transactions: {
        where: { status: { in: ACTIVE_TRANSACTION_STATUSES } },
        orderBy: { createdAt: "desc" },
      },
      tasks: {
        where: { status: "PENDING" },
        orderBy: { dueDate: "asc" },
      },
    },
  });
}

export function getPreviousTransactionsForClient(userId: string, clientId: string) {
  return prisma.transaction.findMany({
    where: { clientId, ownerId: userId, status: { in: CLOSED_TRANSACTION_STATUSES } },
    orderBy: { actualClosingDate: "desc" },
  });
}
