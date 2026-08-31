import "server-only";
import { prisma } from "@/lib/db";

// Owner-scoped list queries backing the section index pages that don't
// yet have their own filtered/detail repo module. Contacts, Clients, and
// Transactions live in src/lib/repos/contacts.ts, clients.ts, and
// transactions.ts respectively.

export function listTasks(userId: string) {
  return prisma.task.findMany({
    where: { assignedUserId: userId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: { transaction: true, client: { include: { contact: true } } },
  });
}

export function listDocuments(userId: string) {
  return prisma.document.findMany({
    where: { uploadedByUserId: userId },
    orderBy: { uploadedAt: "desc" },
    include: { transaction: true, client: { include: { contact: true } } },
  });
}
