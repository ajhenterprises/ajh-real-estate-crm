import webpush from "web-push";
import { prisma } from "@/lib/db";

/**
 * Web Push (VAPID) — no third-party notification service, no per-message
 * cost: web-push talks directly to each browser's own free push service
 * (FCM for Chrome/Edge/Android, Mozilla's for Firefox, Apple's for
 * Safari/iOS 16.4+). Requires VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/
 * VAPID_SUBJECT — generate a keypair with `npx web-push generate-vapid-keys`
 * once, put the values in .env (see .env.example), never rotate them
 * without re-subscribing every device.
 */
function isConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

let configured = false;
function ensureConfigured(): boolean {
  if (!isConfigured()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/**
 * Sends one push message to every subscription on file for `userId`.
 * A subscription the push service reports as gone (410 Gone / 404 Not
 * Found — the user uninstalled the PWA, cleared site data, etc.) is
 * deleted here rather than retried forever. Returns how many sends
 * actually went out, for the cron job's own bookkeeping/logging.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureConfigured()) return 0;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return 0;

  let sent = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => {});
        }
      }
    }),
  );
  return sent;
}
