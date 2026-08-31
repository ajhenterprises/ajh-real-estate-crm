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
