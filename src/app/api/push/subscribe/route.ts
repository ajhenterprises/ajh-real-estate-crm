import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * Stores one browser's push subscription. Called client-side right after
 * `pushManager.subscribe()` succeeds (see push-subscribe-button.tsx) — a
 * plain fetch POST rather than a Server Action, since the subscription
 * object only exists as a browser API result, not form data.
 */
export async function POST(request: NextRequest) {
  const session = await requireSession();

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") {
    return new Response("Invalid subscription.", { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.user.id, endpoint, p256dh, auth },
    update: { userId: session.user.id, p256dh, auth },
  });

  return Response.json({ ok: true });
}
