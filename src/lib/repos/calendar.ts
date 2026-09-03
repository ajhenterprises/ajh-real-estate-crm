import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Every query here is scoped to the current session user, same convention
// as every other repo in this codebase.

export interface CalendarTaskItem {
  kind: "task";
  id: string;
  title: string;
  date: Date;
  priority: string;
  transactionId: string | null;
}

export interface CalendarDeadlineItem {
  kind: "deadline";
  id: string;
  title: string;
  date: Date;
  eventType: string;
  transactionId: string;
  propertyAddress: string | null;
}

export type CalendarItem = CalendarTaskItem | CalendarDeadlineItem;

/** UTC month boundaries for `year`/`month` (1-12) — same UTC-calendar-day convention as src/lib/format.ts. */
export function monthBoundsUTC(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

/**
 * Every task due date and transaction deadline in one UTC month, for the
 * calendar grid — merged and grouped by UTC calendar day (YYYY-MM-DD) so
 * the page never has to reason about time zones, only which cell an item
 * belongs in. Cancelled tasks and non-pending (completed/missed/waived)
 * deadlines are excluded — a calendar's job is showing what's coming up,
 * not a full history (that's what the transaction/task detail pages are for).
 */
export async function getCalendarMonthItems(
  userId: string,
  year: number,
  month: number,
  db: Prisma.TransactionClient = prisma,
): Promise<Map<string, CalendarItem[]>> {
  const { start, end } = monthBoundsUTC(year, month);

  const [tasks, events] = await Promise.all([
    db.task.findMany({
      where: {
        assignedUserId: userId,
        status: "PENDING",
        dueDate: { gte: start, lt: end },
      },
      select: { id: true, title: true, dueDate: true, priority: true, transactionId: true },
    }),
    db.transactionEvent.findMany({
      where: {
        transaction: { ownerId: userId },
        status: "PENDING",
        date: { gte: start, lt: end },
      },
      select: {
        id: true,
        title: true,
        date: true,
        eventType: true,
        transactionId: true,
        transaction: { select: { propertyAddress: true } },
      },
    }),
  ]);

  const byDay = new Map<string, CalendarItem[]>();
  const push = (dateKey: string, item: CalendarItem) => {
    const existing = byDay.get(dateKey);
    if (existing) existing.push(item);
    else byDay.set(dateKey, [item]);
  };

  for (const task of tasks) {
    if (!task.dueDate) continue;
    push(dayKeyUTC(task.dueDate), {
      kind: "task",
      id: task.id,
      title: task.title,
      date: task.dueDate,
      priority: task.priority,
      transactionId: task.transactionId,
    });
  }
  for (const event of events) {
    push(dayKeyUTC(event.date), {
      kind: "deadline",
      id: event.id,
      title: event.title,
      date: event.date,
      eventType: event.eventType,
      transactionId: event.transactionId,
      propertyAddress: event.transaction.propertyAddress,
    });
  }

  return byDay;
}

function dayKeyUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
