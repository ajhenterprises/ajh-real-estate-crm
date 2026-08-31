import "server-only";
import { prisma } from "@/lib/db";

// Owner-scoped list queries backing the section index pages. Each is
// intentionally simple — Phase 1 ships read-only, real-data-or-empty-state
// views; create/edit workflows land in later phases.

export function listContacts(userId: string) {
  return prisma.contact.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { client: true },
  });
}

export function listClients(userId: string) {
  return prisma.client.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { contact: true, transactions: { select: { id: true, status: true } } },
  });
}

export function listTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { client: { include: { contact: true } } },
  });
}

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
