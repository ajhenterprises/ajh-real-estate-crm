// Deliberately no `import "server-only"` here — getContactsNeedingFollowUp
// takes an optional trailing Prisma-client override so it can be exercised
// directly against the dedicated test database in src/test/db.ts (that
// guard throws when imported outside a Next.js server build). Only ever
// imported by the dashboard server component — see src/app/(app)/page.tsx.
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { endOfTodayUTC, startOfTodayUTC } from "@/lib/format";

/**
 * Every query here is scoped to `ownerId`/`assignedUserId` for the current
 * session user — this is the authorization boundary for dashboard data.
 * Nothing here trusts a caller-supplied id.
 *
 * "Today" boundaries all come from format.ts's startOfTodayUTC/endOfTodayUTC
 * (UTC calendar day, matching how date-only fields are stored) rather than
 * local server time — Phase 8 fixed this file's 8 boundary computations,
 * which previously used `setHours(0,0,0,0)` (local time) and only agreed
 * with the UTC storage convention because this app has so far only run on
 * UTC-configured hosts.
 */
export async function getDashboardSummary(userId: string) {
  const startOfToday = startOfTodayUTC();
  const endOfToday = endOfTodayUTC();

  const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

  const [
    activeTransactionsCount,
    tasksDueTodayCount,
    upcomingDeadlinesCount,
    activeClientsCount,
    overdueTasksCount,
    totalContactsCount,
    commissionYtd,
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
    prisma.contact.count({
      where: { ownerId: userId, contactType: "ACTIVE_CLIENT" },
    }),
    prisma.task.count({
      where: { assignedUserId: userId, status: "PENDING", dueDate: { lt: startOfToday } },
    }),
    prisma.contact.count({ where: { ownerId: userId } }),
    prisma.transaction.aggregate({
      where: { ownerId: userId, status: "CLOSED", actualClosingDate: { gte: startOfYear } },
      _sum: { commissionAmount: true },
    }),
  ]);

  return {
    activeTransactionsCount,
    tasksDueTodayCount,
    upcomingDeadlinesCount,
    activeClientsCount,
    overdueTasksCount,
    totalContactsCount,
    commissionEarnedYtd: commissionYtd._sum.commissionAmount?.toString() ?? "0",
  };
}

export async function getOverdueTasks(userId: string) {
  return prisma.task.findMany({
    where: { assignedUserId: userId, status: "PENDING", dueDate: { lt: startOfTodayUTC() } },
    orderBy: { dueDate: "asc" },
    include: { transaction: true, contact: true },
    take: 10,
  });
}

export async function getOverdueDeadlines(userId: string) {
  return prisma.transactionEvent.findMany({
    where: {
      transaction: { ownerId: userId },
      status: "PENDING",
      date: { lt: startOfTodayUTC() },
    },
    orderBy: { date: "asc" },
    include: { transaction: { include: { contact: true } } },
    take: 10,
  });
}

export async function getTasksDueToday(userId: string) {
  return prisma.task.findMany({
    where: {
      assignedUserId: userId,
      status: "PENDING",
      dueDate: { gte: startOfTodayUTC(), lt: endOfTodayUTC() },
    },
    orderBy: { priority: "desc" },
    include: { transaction: true, contact: true },
  });
}

export async function getUpcomingTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      assignedUserId: userId,
      status: "PENDING",
      dueDate: { gte: endOfTodayUTC() },
    },
    orderBy: { dueDate: "asc" },
    include: { transaction: true, contact: true },
    take: 8,
  });
}

export async function getUpcomingDeadlines(userId: string) {
  return prisma.transactionEvent.findMany({
    where: {
      transaction: { ownerId: userId },
      status: "PENDING",
      date: { gte: startOfTodayUTC() },
    },
    orderBy: { date: "asc" },
    include: { transaction: { include: { contact: true } } },
    take: 8,
  });
}

export async function getUpcomingClosings(userId: string) {
  return prisma.transaction.findMany({
    where: {
      ownerId: userId,
      status: { in: ["ACTIVE", "UNDER_CONTRACT", "PENDING"] },
      expectedClosingDate: { gte: startOfTodayUTC() },
    },
    orderBy: { expectedClosingDate: "asc" },
    include: { contact: true },
    take: 8,
  });
}

export async function getUpcomingShowings(userId: string) {
  return prisma.showing.findMany({
    where: {
      ownerId: userId,
      status: "SCHEDULED",
      scheduledAt: { gte: startOfTodayUTC() },
    },
    orderBy: { scheduledAt: "asc" },
    include: { contact: true },
    take: 8,
  });
}

export async function getActiveTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { ownerId: userId, status: { in: ["ACTIVE", "UNDER_CONTRACT", "PENDING"] } },
    orderBy: { expectedClosingDate: "asc" },
    include: {
      contact: true,
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
  return db.contact.findMany({
    where: { ownerId: userId, nextFollowUpDate: { lt: endOfTodayUTC() } },
    orderBy: { nextFollowUpDate: "asc" },
    take: 10,
  });
}
