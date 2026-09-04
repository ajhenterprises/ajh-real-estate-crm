"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOrCreateNotificationPreference } from "@/lib/notifications/scheduling";

const REMINDER_MINUTE_OPTIONS = [0, 15, 60, 1440] as const;

const preferencesSchema = z.object({
  tasksEnabled: z.preprocess((value) => value === "on", z.boolean()),
  followUpsEnabled: z.preprocess((value) => value === "on", z.boolean()),
  transactionDeadlinesEnabled: z.preprocess((value) => value === "on", z.boolean()),
  taskReminderMinutesBefore: z.coerce.number().refine((value) => (REMINDER_MINUTE_OPTIONS as readonly number[]).includes(value)),
  followUpReminderMinutesBefore: z.coerce
    .number()
    .refine((value) => (REMINDER_MINUTE_OPTIONS as readonly number[]).includes(value)),
  // Checkbox group for which day-before offsets to remind at; day-of is
  // always included separately by the scheduling code, never a choice here.
  transactionReminderDaysBefore: z.array(z.coerce.number().int().min(1).max(30)).default([]),
});

export interface NotificationPreferencesState {
  error?: string;
}

export async function updateNotificationPreferencesAction(
  _prevState: NotificationPreferencesState | undefined,
  formData: FormData,
): Promise<NotificationPreferencesState> {
  const session = await requireSession();

  const parsed = preferencesSchema.safeParse({
    tasksEnabled: formData.get("tasksEnabled"),
    followUpsEnabled: formData.get("followUpsEnabled"),
    transactionDeadlinesEnabled: formData.get("transactionDeadlinesEnabled"),
    taskReminderMinutesBefore: formData.get("taskReminderMinutesBefore"),
    followUpReminderMinutesBefore: formData.get("followUpReminderMinutesBefore"),
    transactionReminderDaysBefore: formData.getAll("transactionReminderDaysBefore"),
  });
  if (!parsed.success) {
    return { error: "Check the form and try again." };
  }

  await getOrCreateNotificationPreference(session.user.id);
  await prisma.notificationPreference.update({
    where: { userId: session.user.id },
    data: parsed.data,
  });

  revalidatePath("/settings");
  return {};
}

/** Marks one notification read — called when the agent taps it (see NotificationRow) on the way to the page it links to, and by the standalone "Mark read" button for one they don't want to open right now. */
export async function markNotificationReadAction(formData: FormData) {
  const session = await requireSession();

  const notificationId = formData.get("notificationId");
  if (typeof notificationId !== "string") return;

  await prisma.scheduledNotification.updateMany({
    where: { id: notificationId, userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const session = await requireSession();

  await prisma.scheduledNotification.updateMany({
    where: { userId: session.user.id, sentAt: { not: null }, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/notifications");
}
