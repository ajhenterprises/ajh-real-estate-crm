import type { StatusVariant } from "@/components/ui/status-badge";

const UPCOMING_WINDOW_DAYS = 7;

/**
 * A transaction needs attention if it has an overdue pending deadline, is
 * upcoming if its next deadline falls within the next week, and is
 * otherwise on track. Centralized so the dashboard and transaction list
 * agree on what "on track" means.
 */
export function deriveDeadlineStatus(nextDeadlineDate: Date | null): StatusVariant {
  if (!nextDeadlineDate) return "on-track";

  const now = new Date();
  const msUntil = nextDeadlineDate.getTime() - now.getTime();
  const daysUntil = msUntil / (1000 * 60 * 60 * 24);

  if (daysUntil < 0) return "attention";
  if (daysUntil <= UPCOMING_WINDOW_DAYS) return "upcoming";
  return "on-track";
}

export type FollowUpStatus = "overdue" | "due-today" | "upcoming" | "none";

/**
 * A contact needs follow-up only when an agent explicitly set a
 * `nextFollowUpDate` and that date has arrived — never inferred from how
 * long it's been since the last activity, and never defaulted. `null`
 * always means "none," not "overdue."
 *
 * Uses the same local-server-time "start of today" boundary as every other
 * day-boundary check in this app (dashboard.ts, repos/tasks.ts) rather than
 * a UTC one, deliberately — introducing a third date convention here would
 * make the existing UTC-vs-local inconsistency worse, not better. See the
 * post-Phase-6 audit for that broader issue, tracked separately.
 */
export function deriveFollowUpStatus(nextFollowUpDate: Date | null): FollowUpStatus {
  if (!nextFollowUpDate) return "none";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  if (nextFollowUpDate < startOfToday) return "overdue";
  if (nextFollowUpDate < endOfToday) return "due-today";
  return "upcoming";
}

/** Overdue or due today — the dashboard's "Needs Follow-Up" definition. */
export function needsFollowUp(nextFollowUpDate: Date | null): boolean {
  const status = deriveFollowUpStatus(nextFollowUpDate);
  return status === "overdue" || status === "due-today";
}
