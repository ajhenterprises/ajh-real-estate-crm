import "server-only";
import { prisma } from "@/lib/db";

// Owner-scoped list queries backing section index pages that don't yet
// have their own filtered/detail repo module. Contacts, Transactions, and
// Tasks live in src/lib/repos/contacts.ts, transactions.ts, and tasks.ts
// respectively.

export function listDocuments(userId: string) {
  return prisma.document.findMany({
    where: { uploadedByUserId: userId },
    orderBy: { uploadedAt: "desc" },
    include: {
      transaction: true,
      contact: true,
    },
  });
}
