import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/notifications/push";

/**
 * The entire "background job" this app has: one daily sweep (Vercel Cron —
 * see vercel.json, 8:00 UTC) for ScheduledNotification rows that are due,
 * not a queue, not a long-running worker, and never triggered by
 * client-side polling. Deliberately simple: find what's due, send it, mark
 * it sent. Once-daily is a Hobby-plan constraint (Vercel Cron on Hobby
 * cannot run more than once per day per job) rather than a design choice:
 * transaction-deadline reminders are scheduled for exactly this hour (see
 * REMINDER_HOUR_UTC in scheduling.ts) so they still land on time, but a
 * task/follow-up reminder configured for "N minutes before" can arrive up
 * to a day late if it falls due later the same day. Upgrading to Vercel
 * Pro would allow a tighter schedule (e.g. every 5-15 minutes) if that
 * precision is ever worth the added cost.
 *
 * Protected by CRON_SECRET (Vercel sends it as this exact bearer header
 * for its own scheduled invocations — see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
 * Unset CRON_SECRET is treated as "not configured yet" (503), not as "no
 * auth required" — this must never be reachable by an unauthenticated
 * request in production.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET is not configured.", { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await prisma.scheduledNotification.findMany({
    where: { sentAt: null, sendAt: { lte: new Date() } },
    orderBy: { sendAt: "asc" },
    take: 200,
  });

  let delivered = 0;
  for (const notification of due) {
    const count = await sendPushToUser(notification.userId, {
      title: notification.title,
      body: notification.body,
      url: notification.url,
      tag: notification.id,
    });
    delivered += count;
    // Marked sent regardless of whether a subscription still existed to
    // receive it — a user with push not (or no longer) enabled still gets
    // the row in their in-app Notification Center; "sent" here means
    // "this reminder's moment has passed and been processed," not
    // "a push necessarily went out."
    await prisma.scheduledNotification.update({ where: { id: notification.id }, data: { sentAt: new Date() } });
  }

  return Response.json({ processed: due.length, delivered });
}
