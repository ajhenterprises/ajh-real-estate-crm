/**
 * Whether saving a task edit should mark it as manually overridden. Only a
 * real change to the due date does this — editing title, priority, status,
 * or anything else must never freeze a contract-derived task's calculated
 * due date. Kept as a pure function (not inline in updateTaskAction, which
 * is a "use server" file and can only export async actions) so the rule is
 * unit-testable without a database.
 *
 * `newDueDate` is `undefined` when the form submitted no change to that
 * field — Prisma then leaves the column untouched — so `undefined` means
 * "not a change," not "cleared to no due date."
 */
export function shouldMarkTaskDueDateOverridden(
  existing: { dueDate: Date | null; isOverridden: boolean },
  newDueDate: Date | undefined,
): boolean {
  if (existing.isOverridden) return true;
  if (newDueDate === undefined) return false;
  return newDueDate.getTime() !== (existing.dueDate?.getTime() ?? Number.NaN);
}
