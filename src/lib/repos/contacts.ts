import "server-only";
import { prisma } from "@/lib/db";

// Every query here is scoped to `ownerId` for the current session user —
// a contact id alone (however it reaches the server) is never sufficient
// to read it. See getContactById in particular: it returns null rather
// than the row when the id belongs to someone else, so callers can 404.

export function listContacts(userId: string) {
  return prisma.contact.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    include: { client: true },
  });
}

export function getContactById(userId: string, contactId: string) {
  return prisma.contact.findFirst({
    where: { id: contactId, ownerId: userId },
    include: {
      client: {
        include: {
          transactions: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      },
      tasks: {
        where: { status: "PENDING" },
        orderBy: { dueDate: "asc" },
        take: 10,
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}
