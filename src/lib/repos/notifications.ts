import { prisma } from "@/lib/db";

/** Not-yet-sent reminders, soonest first — "what's coming up." */
export function listUpcomingNotifications(userId: string, take = 20) {
  return prisma.scheduledNotification.findMany({
    where: { userId, sentAt: null },
    orderBy: { sendAt: "asc" },
    take,
  });
}

/** Already-sent reminders, most recent first — "what already happened." Read/unread both included; the page itself distinguishes them. */
export function listRecentNotifications(userId: string, take = 30) {
  return prisma.scheduledNotification.findMany({
    where: { userId, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    take,
  });
}

export function countUnreadNotifications(userId: string) {
  return prisma.scheduledNotification.count({ where: { userId, sentAt: { not: null }, readAt: null } });
}
