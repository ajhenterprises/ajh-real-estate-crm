import type { StatusVariant } from "@/components/ui/status-badge";
import { endOfTodayUTC, startOfTodayUTC } from "@/lib/format";

const UPCOMING_WINDOW_DAYS = 7;

/**
 * A transaction needs attention if it has an overdue pending deadline, is
 * upcoming if its next deadline falls within the next week (today included),
 * and is otherwise on track. Centralized so the dashboard and transaction
 * list agree on what "on track" means.
 *
 * Bucketed by UTC calendar day, matching how date-only fields are stored
 * (see format.ts) — not a continuous time-until-deadline subtraction. That
 * distinction is the Phase 8 fix: `nextDeadlineDate` is always UTC midnight
 * of its day, so comparing it against the real current instant (with a
 * time-of-day) instead of the start of today made a deadline due *today*
 * read as already overdue for the entire day, in every timezone including
 * UTC. `now` defaults to the real current instant; tests pass a fixed value.
 */
export function deriveDeadlineStatus(nextDeadlineDate: Date | null, now: Date = new Date()): StatusVariant {
  if (!nextDeadlineDate) return "on-track";

  const startOfToday = startOfTodayUTC(now);
  if (nextDeadlineDate < startOfToday) return "attention";

  const daysUntil = Math.round((nextDeadlineDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
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
 * Uses the same UTC "start of today" boundary as every other day-boundary
 * check in this app (see format.ts's startOfTodayUTC/endOfTodayUTC) — this
 * used to be a local-server-time boundary; Phase 8 unified it with the
 * storage/display convention rather than leaving a third, inconsistent one.
 */
export function deriveFollowUpStatus(nextFollowUpDate: Date | null, now: Date = new Date()): FollowUpStatus {
  if (!nextFollowUpDate) return "none";

  const startOfToday = startOfTodayUTC(now);
  const endOfToday = endOfTodayUTC(now);

  if (nextFollowUpDate < startOfToday) return "overdue";
  if (nextFollowUpDate < endOfToday) return "due-today";
  return "upcoming";
}

/** Overdue or due today — the dashboard's "Needs Follow-Up" definition. */
export function needsFollowUp(nextFollowUpDate: Date | null, now: Date = new Date()): boolean {
  const status = deriveFollowUpStatus(nextFollowUpDate, now);
  return status === "overdue" || status === "due-today";
}
