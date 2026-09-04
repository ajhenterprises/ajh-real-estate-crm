import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationCategory } from "@/generated/prisma/enums";

/**
 * Turns tasks/follow-ups/transaction deadlines into ScheduledNotification
 * rows the cron job (src/app/api/cron/send-notifications) later sends as
 * push messages. Every function here is cancel-then-recreate rather than
 * update-in-place: a date changing is handled by deleting whatever rows
 * exist for that source and computing fresh ones, which is what makes
 * "an addendum changed the closing date" or "the agent edited a task's due
 * date" trivially correct instead of a diffing problem. Never sends
 * anything itself — this only ever writes rows the cron job will later
 * read; scheduling never touches web-push imports/env directly.
 */

const REMINDER_HOUR_UTC = 8; // Fixed local-morning-ish time for date-only (no time-of-day) reminders — transaction deadlines.

export async function getOrCreateNotificationPreference(userId: string, db: Prisma.TransactionClient = prisma) {
  const existing = await db.notificationPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.notificationPreference.create({ data: { userId } });
}

async function upsertScheduledNotification(
  db: Prisma.TransactionClient,
  params: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    url: string;
    sendAt: Date;
    sourceType: string;
    sourceId: string;
    offsetKey: string;
  },
) {
  // Never schedule (or re-schedule) something already in the past — a
  // task edited to a due date/time that's already gone shouldn't fire the
  // moment it's saved.
  if (params.sendAt.getTime() <= Date.now()) return;

  await db.scheduledNotification.upsert({
    where: { sourceType_sourceId_offsetKey: { sourceType: params.sourceType, sourceId: params.sourceId, offsetKey: params.offsetKey } },
    create: params,
    update: {
      title: params.title,
      body: params.body,
      url: params.url,
      sendAt: params.sendAt,
      sentAt: null,
    },
  });
}

/** Deletes every not-yet-sent reminder for one source record. Sent ones are left alone — they're history in the Notification Center, not a live schedule. */
async function cancelPending(db: Prisma.TransactionClient, sourceType: string, sourceId: string) {
  await db.scheduledNotification.deleteMany({ where: { sourceType, sourceId, sentAt: null } });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function cancelTaskReminder(taskId: string, db: Prisma.TransactionClient = prisma) {
  await cancelPending(db, "TASK", taskId);
}

/** Called after a task is created/updated. Reschedules from scratch — safe to call unconditionally any time a task's dueDate, title, status, or assignee could have changed. */
export async function scheduleTaskReminder(
  task: { id: string; title: string; dueDate: Date | null; status: string; assignedUserId: string },
  db: Prisma.TransactionClient = prisma,
) {
  await cancelTaskReminder(task.id, db);
  if (task.status !== "PENDING" || !task.dueDate) return;

  const preference = await getOrCreateNotificationPreference(task.assignedUserId, db);
  if (!preference.tasksEnabled) return;

  const sendAt = new Date(task.dueDate.getTime() - preference.taskReminderMinutesBefore * 60_000);
  await upsertScheduledNotification(db, {
    userId: task.assignedUserId,
    category: "TASK",
    title: "Task due" + (preference.taskReminderMinutesBefore > 0 ? " soon" : ""),
    body: task.title,
    url: `/tasks/${task.id}`,
    sendAt,
    sourceType: "TASK",
    sourceId: task.id,
    offsetKey: "AT_TIME",
  });
}

// ---------------------------------------------------------------------------
// Contact follow-ups
// ---------------------------------------------------------------------------

export async function cancelFollowUpReminder(contactId: string, db: Prisma.TransactionClient = prisma) {
  await cancelPending(db, "FOLLOW_UP", contactId);
}

export async function scheduleFollowUpReminder(
  contact: { id: string; ownerId: string; nextFollowUpDate: Date | null; firstName: string; lastName: string },
  db: Prisma.TransactionClient = prisma,
) {
  await cancelFollowUpReminder(contact.id, db);
  if (!contact.nextFollowUpDate) return;

  const preference = await getOrCreateNotificationPreference(contact.ownerId, db);
  if (!preference.followUpsEnabled) return;

  const sendAt = new Date(contact.nextFollowUpDate.getTime() - preference.followUpReminderMinutesBefore * 60_000);
  await upsertScheduledNotification(db, {
    userId: contact.ownerId,
    category: "FOLLOW_UP",
    title: "Follow-up due",
    body: `${contact.firstName} ${contact.lastName}`,
    url: `/contacts/${contact.id}`,
    sendAt,
    sourceType: "FOLLOW_UP",
    sourceId: contact.id,
    offsetKey: "AT_TIME",
  });
}

// ---------------------------------------------------------------------------
// Transaction key dates
// ---------------------------------------------------------------------------

export async function cancelTransactionEventReminders(eventId: string, db: Prisma.TransactionClient = prisma) {
  await cancelPending(db, "TRANSACTION_EVENT", eventId);
}

/** Cancels reminders for every event on a transaction — called when the transaction itself is closed/cancelled, since none of its remaining deadlines still matter. */
export async function cancelTransactionReminders(transactionId: string, db: Prisma.TransactionClient = prisma) {
  const events = await db.transactionEvent.findMany({ where: { transactionId }, select: { id: true } });
  await db.scheduledNotification.deleteMany({
    where: { sourceType: "TRANSACTION_EVENT", sourceId: { in: events.map((e) => e.id) }, sentAt: null },
  });
}

/**
 * Schedules the configured before-deadline reminders plus a fixed day-of
 * reminder for one transaction event. Called after every create/update of
 * a PENDING TransactionEvent (confirming contract information, an
 * addendum-driven amendment, or a manual date edit) — always
 * cancel-then-recreate, so a date change just works.
 */
export async function scheduleTransactionEventReminders(
  event: {
    id: string;
    transactionId: string;
    title: string;
    date: Date;
    status: string;
  },
  ownerId: string,
  propertyAddress: string | null,
  db: Prisma.TransactionClient = prisma,
) {
  await cancelTransactionEventReminders(event.id, db);
  if (event.status !== "PENDING") return;

  const preference = await getOrCreateNotificationPreference(ownerId, db);
  if (!preference.transactionDeadlinesEnabled) return;

  const label = propertyAddress ? `${event.title} — ${propertyAddress}` : event.title;
  const daysBefore = [...new Set([...preference.transactionReminderDaysBefore, 0])].sort((a, b) => b - a);

  for (const days of daysBefore) {
    const sendAt = new Date(event.date);
    sendAt.setUTCDate(sendAt.getUTCDate() - days);
    sendAt.setUTCHours(REMINDER_HOUR_UTC, 0, 0, 0);

    await upsertScheduledNotification(db, {
      userId: ownerId,
      category: "TRANSACTION_DEADLINE",
      title: days === 0 ? "Deadline today" : `Deadline in ${days} day${days === 1 ? "" : "s"}`,
      body: label,
      url: `/transactions/${event.transactionId}`,
      sendAt,
      sourceType: "TRANSACTION_EVENT",
      sourceId: event.id,
      offsetKey: days === 0 ? "DAY_OF" : `DAYS_BEFORE_${days}`,
    });
  }
}
