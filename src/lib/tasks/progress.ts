import type { TaskStatus } from "@/generated/prisma/enums";

export interface TaskProgressSummary {
  /** Non-cancelled tasks — the denominator for "X of Y complete". */
  total: number;
  complete: number;
  overdue: number;
  /** Pending, not overdue (due later or no due date at all). */
  upcoming: number;
}

/**
 * Summarizes a transaction's (or any) task list into the red/yellow/green
 * counts used on both the transaction checklist and the dashboard's active
 * transaction rows, so the two never disagree about what "overdue" means.
 */
export function summarizeTaskProgress(
  tasks: { status: TaskStatus; dueDate: Date | null }[],
): TaskProgressSummary {
  const active = tasks.filter((t) => t.status !== "CANCELLED");
  const complete = active.filter((t) => t.status === "COMPLETED").length;
  const now = new Date();
  const overdue = active.filter(
    (t) => t.status === "PENDING" && t.dueDate !== null && t.dueDate < now,
  ).length;
  const upcoming = active.length - complete - overdue;

  return { total: active.length, complete, overdue, upcoming };
}
