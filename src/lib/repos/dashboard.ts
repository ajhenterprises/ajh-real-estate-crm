// Deliberately no `import "server-only"` here — getContactsNeedingFollowUp
// takes an optional trailing Prisma-client override so it can be exercised
// directly against the dedicated test database in src/test/db.ts (that
// guard throws when imported outside a Next.js server build). Only ever
// imported by the dashboard server component — see src/app/(app)/page.tsx.
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Every query here is scoped to `ownerId`/`assignedUserId` for the current
 * session user — this is the authorization boundary for dashboard data.
 * Nothing here trusts a caller-supplied id.
 */
export async function getDashboardSummary(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [
    activeTransactionsCount,
    tasksDueTodayCount,
    upcomingDeadlinesCount,
    activeClientsCount,
    overdueTasksCount,
  ] = await Promise.all([
    prisma.transaction.count({
      where: {
        ownerId: userId,
        status: { in: ["ACTIVE", "UNDER_CONTRACT", "PENDING"] },
      },
    }),
    prisma.task.count({
      where: {
        assignedUserId: userId,
        status: "PENDING",
        dueDate: { gte: startOfToday, lt: endOfToday },
      },
    }),
    prisma.transactionEvent.count({
      where: {
        transaction: { ownerId: userId },
        status: "PENDING",
        date: { gte: startOfToday },
      },
    }),
    prisma.client.count({
      where: { ownerId: userId, status: "ACTIVE" },
    }),
    prisma.task.count({
      where: { assignedUserId: userId, status: "PENDING", dueDate: { lt: startOfToday } },
    }),
  ]);

  return {
    activeTransactionsCount,
    tasksDueTodayCount,
    upcomingDeadlinesCount,
    activeClientsCount,
    overdueTasksCount,
  };
}

export async function getOverdueTasks(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.task.findMany({
    where: { assignedUserId: userId, status: "PENDING", dueDate: { lt: startOfToday } },
    orderBy: { dueDate: "asc" },
    include: { transaction: true, client: { include: { contact: true } } },
    take: 10,
  });
}

export async function getOverdueDeadlines(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.transactionEvent.findMany({
    where: {
      transaction: { ownerId: userId },
      status: "PENDING",
      date: { lt: startOfToday },
    },
    orderBy: { date: "asc" },
    include: { transaction: { include: { client: { include: { contact: true } } } } },
    take: 10,
  });
}

export async function getTasksDueToday(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  return prisma.task.findMany({
    where: {
      assignedUserId: userId,
      status: "PENDING",
      dueDate: { gte: startOfToday, lt: endOfToday },
    },
    orderBy: { priority: "desc" },
    include: { transaction: true, client: { include: { contact: true } } },
  });
}

export async function getUpcomingTasks(userId: string) {
  const endOfToday = new Date();
  endOfToday.setHours(0, 0, 0, 0);
  endOfToday.setDate(endOfToday.getDate() + 1);

  return prisma.task.findMany({
    where: {
      assignedUserId: userId,
      status: "PENDING",
      dueDate: { gte: endOfToday },
    },
    orderBy: { dueDate: "asc" },
    include: { transaction: true, client: { include: { contact: true } } },
    take: 8,
  });
}

export async function getUpcomingDeadlines(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.transactionEvent.findMany({
    where: {
      transaction: { ownerId: userId },
      status: "PENDING",
      date: { gte: startOfToday },
    },
    orderBy: { date: "asc" },
    include: { transaction: { include: { client: { include: { contact: true } } } } },
    take: 8,
  });
}

export async function getUpcomingClosings(userId: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return prisma.transaction.findMany({
    where: {
      ownerId: userId,
      status: { in: ["ACTIVE", "UNDER_CONTRACT", "PENDING"] },
      expectedClosingDate: { gte: startOfToday },
    },
    orderBy: { expectedClosingDate: "asc" },
    include: { client: { include: { contact: true } } },
    take: 8,
  });
}

export async function getActiveTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { ownerId: userId, status: { in: ["ACTIVE", "UNDER_CONTRACT", "PENDING"] } },
    orderBy: { expectedClosingDate: "asc" },
    include: {
      client: { include: { contact: true } },
      events: { where: { status: "PENDING" }, orderBy: { date: "asc" }, take: 1 },
      tasks: { select: { status: true, dueDate: true } },
    },
    take: 10,
  });
}

/**
 * Contacts whose agent-set `nextFollowUpDate` is today or earlier — never
 * contacts with no follow-up date set (that is not "needs follow-up," per
 * the Phase 7 spec: no invented staleness threshold). Oldest/most-overdue
 * first, same `take` as the Overdue Tasks/Deadlines sections above.
 *
 * Takes an optional trailing Prisma-client override (defaulting to the real
 * app singleton) so this exact function — not a reimplementation of it —
 * can be exercised against the dedicated test database; see src/test/db.ts.
 */
export async function getContactsNeedingFollowUp(userId: string, db: Prisma.TransactionClient = prisma) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  return db.contact.findMany({
    where: { ownerId: userId, nextFollowUpDate: { lt: endOfToday } },
    orderBy: { nextFollowUpDate: "asc" },
    take: 10,
  });
}
