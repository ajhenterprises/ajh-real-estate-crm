import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionType } from "@/generated/prisma/enums";

/**
 * Computes a template's due date, if it has a rule. Both fields absent
 * means "no due date" — the default for every seeded template (see
 * src/lib/tasks/default-templates.ts). If the rule anchors to the expected
 * closing date and the transaction doesn't have one yet, the task simply
 * gets no due date rather than a guessed one.
 */
function resolveDueDate(
  template: { dueDateOffsetDays: number | null; dueDateAnchor: "TRANSACTION_CREATED" | "EXPECTED_CLOSING_DATE" | null },
  transaction: { createdAt: Date; expectedClosingDate: Date | null },
): Date | null {
  if (template.dueDateOffsetDays === null || template.dueDateAnchor === null) return null;

  const anchorDate =
    template.dueDateAnchor === "EXPECTED_CLOSING_DATE"
      ? transaction.expectedClosingDate
      : transaction.createdAt;
  if (!anchorDate) return null;

  const due = new Date(anchorDate);
  due.setDate(due.getDate() + template.dueDateOffsetDays);
  return due;
}

/**
 * Generates the standard checklist for a newly-created transaction, inside
 * the same transaction (`tx`) that created it, so the Transaction row and
 * its checklist either both exist or neither does.
 *
 * Idempotent by construction, two ways: (1) it no-ops if this transaction
 * already has any TRANSACTION_TEMPLATE-sourced task, so calling it twice
 * for the same transaction id is always safe; (2) `Task.@@unique([
 * transactionId, templateId])` is a hard database backstop against ever
 * creating two tasks from the same template for the same transaction, even
 * under a race. Nothing calls this from the edit/update path — only
 * creation — so a normal page refresh can never re-trigger it.
 */
export async function generateChecklistForTransaction(
  tx: Prisma.TransactionClient,
  transaction: {
    id: string;
    type: TransactionType;
    ownerId: string;
    createdAt: Date;
    expectedClosingDate: Date | null;
  },
): Promise<void> {
  // "Other" transactions get no buyer/seller-specific checklist — see
  // Phase 4 spec item 13. (No OTHER-type templates exist to match anyway.)
  if (transaction.type !== "BUYER" && transaction.type !== "SELLER") return;

  const alreadyGenerated = await tx.task.findFirst({
    where: { transactionId: transaction.id, source: "TRANSACTION_TEMPLATE" },
    select: { id: true },
  });
  if (alreadyGenerated) return;

  const templates = await tx.taskTemplate.findMany({
    where: { transactionType: transaction.type, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (templates.length === 0) return;

  await tx.task.createMany({
    data: templates.map((template) => ({
      title: template.title,
      description: template.description,
      priority: template.priority,
      category: template.category,
      dueDate: resolveDueDate(template, transaction),
      source: "TRANSACTION_TEMPLATE" as const,
      templateId: template.id,
      transactionId: transaction.id,
      assignedUserId: transaction.ownerId,
    })),
    skipDuplicates: true,
  });
}
