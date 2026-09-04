import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const session = await requireSession();

  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") {
    return new Response("Invalid request.", { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });

  return Response.json({ ok: true });
}
