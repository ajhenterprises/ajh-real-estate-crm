"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

/**
 * Every mutation here re-derives the current user from the session and
 * filters the update by `assignedUserId` — a task id alone is never enough
 * to touch a row. Prisma's `updateMany` with that filter makes a
 * cross-user task id a silent no-op instead of a leak.
 */
async function setTaskStatus(taskId: string, status: "PENDING" | "COMPLETED") {
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
