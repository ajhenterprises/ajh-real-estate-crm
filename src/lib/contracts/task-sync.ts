import type { Prisma } from "@/generated/prisma/client";
import type { TaskStatus, TransactionEventType } from "@/generated/prisma/enums";

/**
 * Contract-derived tasks (Phase 6) only exist for deadlines that imply real
 * prep work between confirmation and the deadline itself. The other event
 * types this system produces — CONTRACT_EFFECTIVE, EARNEST_MONEY_DUE,
 * CLOSING_DATE, INSPECTION_PERIOD_START — are directly-entered milestones
 * already covered by the buyer/seller checklist templates (see
 * src/lib/tasks/default-templates.ts), so generating a second task for them
 * would duplicate the checklist rather than add anything.
 */
export const CONTRACT_TASK_EVENT_TYPES = [
  "INSPECTION_PERIOD_END",
  "FINANCING_DEADLINE",
  "APPRAISAL_DEADLINE",
  "TITLE_DEADLINE",
] as const;

export type ContractTaskEventType = (typeof CONTRACT_TASK_EVENT_TYPES)[number];

export function isContractTaskEventType(eventType: TransactionEventType): eventType is ContractTaskEventType {
  return (CONTRACT_TASK_EVENT_TYPES as readonly string[]).includes(eventType);
}

/** Category every contract-derived task is grouped under in the transaction checklist. */
export const CONTRACT_TASK_CATEGORY = "Contract Deadlines";

export type ContractTaskReconciliation =
  | { kind: "create" }
  | { kind: "sync" }
  | { kind: "skip" };

/**
 * Pure decision of what re-confirming a contract should do to the task tied
 * to one of its deadlines. Kept separate from the Prisma calls that act on
 * it so the rule itself — never touch a completed/cancelled task, never
 * overwrite a manually-overridden due date, never duplicate — is testable
 * without a database.
 */
export function decideContractTaskReconciliation(
  existing: { status: TaskStatus; isOverridden: boolean } | null,
): ContractTaskReconciliation {
  if (!existing) return { kind: "create" };
  if (existing.status !== "PENDING") return { kind: "skip" };
  if (existing.isOverridden) return { kind: "skip" };
  return { kind: "sync" };
}

/**
 * Creates or reconciles the single task tied to one contract-derived
 * TransactionEvent, inside the same transaction that upserted the event.
 * `Task.transactionEventId` is unique, so this can never produce a second
 * task for the same event even under a race — the unique constraint is the
 * database backstop behind the pre-check here (same duplicate-protection
 * shape as generateChecklistForTransaction in src/lib/tasks/checklist.ts).
 */
export async function reconcileContractDerivedTask(
  tx: Prisma.TransactionClient,
  params: {
    event: { id: string; title: string; date: Date };
    transactionId: string;
    assignedUserId: string;
  },
): Promise<void> {
  const existingTask = await tx.task.findUnique({
    where: { transactionEventId: params.event.id },
    select: { id: true, status: true, isOverridden: true },
  });

  const decision = decideContractTaskReconciliation(existingTask);

  if (decision.kind === "create") {
    await tx.task.create({
      data: {
        title: params.event.title,
        description: `Generated from the contract's ${params.event.title} deadline.`,
        category: CONTRACT_TASK_CATEGORY,
        source: "FUTURE_CONTRACT",
        dueDate: params.event.date,
        transactionEventId: params.event.id,
        transactionId: params.transactionId,
        assignedUserId: params.assignedUserId,
      },
    });
    return;
  }

  if (decision.kind === "sync") {
    await tx.task.update({
      where: { id: existingTask!.id },
      data: { dueDate: params.event.date },
    });
  }

  // "skip": completed, cancelled, or manually overridden — left untouched.
}
