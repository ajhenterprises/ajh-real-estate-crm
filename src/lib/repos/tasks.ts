import "server-only";
import { prisma } from "@/lib/db";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/enums";
import { startOfTodayUTC } from "@/lib/format";

export type TaskStatusFilter = "PENDING" | "COMPLETED" | "CANCELLED" | "OVERDUE";
export type TaskRelationshipFilter = "TRANSACTION" | "CONTACT" | "GENERAL";
export type TaskSort = "smart" | "due_date" | "priority" | "newest" | "oldest";

export interface TaskListFilters {
  search?: string;
  status?: TaskStatusFilter;
  priority?: TaskPriority;
  relationship?: TaskRelationshipFilter;
  sort?: TaskSort;
}

const taskInclude = {
  transaction: { select: { id: true, propertyAddress: true } },
  contact: { select: { id: true, firstName: true, lastName: true } },
  transactionEvent: { select: { id: true, eventType: true, title: true, date: true } },
} as const;

// Buckets tasks into "actionable work first": overdue, due today, upcoming,
// no due date, then completed, then cancelled — the default ordering the
// global Tasks page and dashboard should agree on regardless of which
// status filter is active.
function smartBucket(task: { status: TaskStatus; dueDate: Date | null }): number {
  if (task.status === "CANCELLED") return 5;
  if (task.status === "COMPLETED") return 4;
  if (!task.dueDate) return 3;

  const today = startOfTodayUTC();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (task.dueDate < today) return 0;
  if (task.dueDate < tomorrow) return 1;
  return 2;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { URGENT: 3, HIGH: 2, NORMAL: 1, LOW: 0 };

function sortTasks<T extends { status: TaskStatus; dueDate: Date | null; priority: TaskPriority; createdAt: Date }>(
  tasks: T[],
  sort: TaskSort,
): T[] {
  const withDueOrEnd = (t: T) => t.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;

  switch (sort) {
    case "due_date":
      return [...tasks].sort((a, b) => withDueOrEnd(a) - withDueOrEnd(b));
    case "priority":
      return [...tasks].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    case "newest":
      return [...tasks].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case "oldest":
      return [...tasks].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case "smart":
    default:
      return [...tasks].sort((a, b) => {
        const bucketDiff = smartBucket(a) - smartBucket(b);
        if (bucketDiff !== 0) return bucketDiff;
        const dueDiff = withDueOrEnd(a) - withDueOrEnd(b);
        if (dueDiff !== 0) return dueDiff;
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      });
  }
}

// Scoped to `assignedUserId` for the current session user — every filter is
// additive on top of that, never a substitute for it.
export async function listTasks(userId: string, filters: TaskListFilters = {}) {
  const { search, status, priority, relationship, sort = "smart" } = filters;

  const tasks = await prisma.task.findMany({
    where: {
      assignedUserId: userId,
      ...(priority ? { priority } : {}),
      ...(status === "OVERDUE"
        ? { status: "PENDING", dueDate: { lt: startOfTodayUTC() } }
        : status
          ? { status }
          : {}),
      ...(relationship === "TRANSACTION"
        ? { transactionId: { not: null } }
        : relationship === "CONTACT"
          ? { transactionId: null, contactId: { not: null } }
          : relationship === "GENERAL"
            ? { transactionId: null, contactId: null }
            : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { transaction: { propertyAddress: { contains: search, mode: "insensitive" as const } } },
              { contact: { firstName: { contains: search, mode: "insensitive" as const } } },
              { contact: { lastName: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    include: taskInclude,
  });

  return sortTasks(tasks, sort);
}

export function getTaskById(userId: string, taskId: string) {
  return prisma.task.findFirst({
    where: { id: taskId, assignedUserId: userId },
    include: taskInclude,
  });
}

/** Lightweight option lists for the contact/transaction pickers on the task form. */
export async function listTaskFormOptions(userId: string) {
  const [contacts, transactions] = await Promise.all([
    prisma.contact.findMany({
      where: { ownerId: userId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.transaction.findMany({
      where: { ownerId: userId },
      select: { id: true, propertyAddress: true, contact: { select: { firstName: true, lastName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return { contacts, transactions };
}
