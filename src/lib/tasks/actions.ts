"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { shouldMarkTaskDueDateOverridden } from "@/lib/tasks/due-date-override";

/**
 * Every mutation here re-derives the current user from the session and
 * filters by `assignedUserId` (or, for create, re-validates any supplied
 * client/transaction id against the session user) — an id alone, however
 * it reaches the server, is never enough to read or touch a row.
 */
async function setTaskStatus(taskId: string, status: "PENDING" | "COMPLETED" | "CANCELLED") {
  const session = await requireSession();

  await prisma.task.updateMany({
    where: { id: taskId, assignedUserId: session.user.id },
    data: {
      status,
      completedDate: status === "COMPLETED" ? new Date() : null,
    },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/transactions", "layout");
  revalidatePath("/clients", "layout");
}

export async function completeTaskAction(formData: FormData) {
  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;
  await setTaskStatus(taskId, "COMPLETED");
}

export async function reopenTaskAction(formData: FormData) {
  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;
  await setTaskStatus(taskId, "PENDING");
}

export async function cancelTaskAction(formData: FormData) {
  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;
  await setTaskStatus(taskId, "CANCELLED");
}

const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const TASK_STATUSES = ["PENDING", "COMPLETED", "CANCELLED"] as const;

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().trim().optional());
const optionalDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .transform((value) => new Date(value))
    .optional(),
);

const taskFieldsSchema = {
  title: z.string().trim().min(1, "Title is required"),
  description: optionalString,
  dueDate: optionalDate,
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  clientId: optionalString,
  transactionId: optionalString,
};

const createTaskSchema = z.object(taskFieldsSchema);
const updateTaskSchema = z.object({ taskId: z.string().min(1), ...taskFieldsSchema });

export interface TaskFormState {
  error?: string;
}

/** Verifies clientId/transactionId (if provided) belong to this user; returns them narrowed to string | null. */
async function resolveOwnedRelations(
  userId: string,
  clientId: string | undefined,
  transactionId: string | undefined,
): Promise<{ clientId: string | null; transactionId: string | null } | { error: string }> {
  if (clientId) {
    const client = await prisma.client.findFirst({ where: { id: clientId, ownerId: userId } });
    if (!client) return { error: "That client could not be found." };
  }
  if (transactionId) {
    const transaction = await prisma.transaction.findFirst({
      where: { id: transactionId, ownerId: userId },
    });
    if (!transaction) return { error: "That transaction could not be found." };
  }
  return { clientId: clientId ?? null, transactionId: transactionId ?? null };
}

export async function createTaskAction(
  _prevState: TaskFormState | undefined,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await requireSession();

  const parsed = createTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { clientId, transactionId, ...fields } = parsed.data;
  const relations = await resolveOwnedRelations(session.user.id, clientId, transactionId);
  if ("error" in relations) return relations;

  const task = await prisma.task.create({
    data: {
      ...fields,
      completedDate: fields.status === "COMPLETED" ? new Date() : null,
      source: "MANUAL",
      assignedUserId: session.user.id,
      clientId: relations.clientId,
      transactionId: relations.transactionId,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  if (relations.transactionId) revalidatePath(`/transactions/${relations.transactionId}`);
  if (relations.clientId) revalidatePath(`/clients/${relations.clientId}`);
  redirect(`/tasks/${task.id}`);
}

export async function updateTaskAction(
  _prevState: TaskFormState | undefined,
  formData: FormData,
): Promise<TaskFormState> {
  const session = await requireSession();

  const parsed = updateTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { taskId, clientId, transactionId, ...fields } = parsed.data;

  const existing = await prisma.task.findFirst({ where: { id: taskId, assignedUserId: session.user.id } });
  if (!existing) {
    return { error: "That task could not be found." };
  }

  const relations = await resolveOwnedRelations(session.user.id, clientId, transactionId);
  if ("error" in relations) return relations;

  const completedDate =
    fields.status === "COMPLETED" ? (existing.completedDate ?? new Date()) : null;

  const isOverridden = shouldMarkTaskDueDateOverridden(existing, fields.dueDate);

  await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...fields,
      completedDate,
      isOverridden,
      clientId: relations.clientId,
      transactionId: relations.transactionId,
    },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${existing.id}`);
  revalidatePath("/");
  if (existing.transactionId) revalidatePath(`/transactions/${existing.transactionId}`);
  if (relations.transactionId) revalidatePath(`/transactions/${relations.transactionId}`);
  if (existing.clientId) revalidatePath(`/clients/${existing.clientId}`);
  if (relations.clientId) revalidatePath(`/clients/${relations.clientId}`);
  redirect(`/tasks/${existing.id}`);
}

const addTransactionTaskSchema = z.object({
  transactionId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required"),
  dueDate: optionalDate,
  priority: z.enum(TASK_PRIORITIES),
});

export interface AddTransactionTaskState {
  error?: string;
}

/**
 * Quick-add for the transaction checklist: unlike createTaskAction, this
 * stays on the transaction page rather than redirecting to the new task's
 * detail page, matching AddEventForm's pattern for the same section.
 */
export async function addTransactionTaskAction(
  _prevState: AddTransactionTaskState | undefined,
  formData: FormData,
): Promise<AddTransactionTaskState> {
  const session = await requireSession();

  const parsed = addTransactionTaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const { transactionId, title, dueDate, priority } = parsed.data;

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, ownerId: session.user.id },
  });
  if (!transaction) {
    return { error: "That transaction could not be found." };
  }

  await prisma.task.create({
    data: {
      title,
      dueDate,
      priority,
      source: "MANUAL",
      transactionId: transaction.id,
      assignedUserId: session.user.id,
    },
  });

  revalidatePath(`/transactions/${transaction.id}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  return {};
}

/**
 * Discards a manual due-date override on a contract-derived task, restoring
 * the due date to whatever its linked TransactionEvent's current date is.
 * Mirrors resetTransactionEventOverrideAction's contract with the same
 * event. A no-op for a task with no linked event.
 */
export async function resetTaskDueDateOverrideAction(formData: FormData) {
  const session = await requireSession();

  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, assignedUserId: session.user.id },
    include: { transactionEvent: { select: { date: true } } },
  });
  if (!task || !task.transactionEvent) return;

  await prisma.task.update({
    where: { id: task.id },
    data: { dueDate: task.transactionEvent.date, isOverridden: false },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${task.id}`);
  revalidatePath("/");
  if (task.transactionId) revalidatePath(`/transactions/${task.transactionId}`);
}
