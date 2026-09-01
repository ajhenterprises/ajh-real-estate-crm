import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ExternalProvider } from "@/generated/prisma/enums";

/**
 * Webhook foundation: safely recording an inbound delivery, idempotently,
 * and tracking its processing state. No live HTTP route accepts real
 * deliveries yet — deliberately. A generic route would need to parse each
 * provider's own event-id/type field names and verify each provider's own
 * signature scheme before it could safely call recordWebhookEvent below,
 * and none of that is known yet (that's exactly the kind of provider
 * difference ProviderAdapter — provider-adapter.ts — exists to own). A
 * route that guessed at those would either do nothing useful or, worse,
 * return 200 to the provider (telling it delivery succeeded) while
 * silently failing to record the event correctly — building that would be
 * the "fake integration that pretends to work" this phase is explicitly
 * not meant to create. The real endpoint is future work, once a specific
 * provider's payload shape is known; everything up to that — the model,
 * the idempotent recording, the processing-state machine — is built and
 * tested here now.
 *
 * NEVER log a full payload in a way that could contain a secret a
 * provider embedded in it (e.g. a signing verification value echoed back).
 * This module never logs payload contents at all — callers that do their
 * own logging around this must apply the same care.
 */

export type RecordWebhookEventResult =
  | { outcome: "recorded"; webhookEventId: string }
  | { outcome: "duplicate"; webhookEventId: string };

/**
 * Idempotently records an inbound webhook delivery. The (provider,
 * externalEventId) unique constraint is the actual idempotency mechanism:
 * a redelivery of the same event returns "duplicate" (with the id of the
 * row already recorded on the first delivery) rather than creating a
 * second row or throwing — callers must treat "duplicate" as "already
 * being handled or already handled, do not process again," never as an
 * error.
 */
export async function recordWebhookEvent(
  params: {
    provider: ExternalProvider;
    integrationId?: string;
    externalEventId: string;
    eventType: string;
    payload?: Prisma.InputJsonValue;
  },
  db: Prisma.TransactionClient = prisma,
): Promise<RecordWebhookEventResult> {
  try {
    const event = await db.webhookEvent.create({
      data: {
        provider: params.provider,
        integrationId: params.integrationId,
        externalEventId: params.externalEventId,
        eventType: params.eventType,
        payload: params.payload,
      },
    });
    return { outcome: "recorded", webhookEventId: event.id };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      const existing = await db.webhookEvent.findUniqueOrThrow({
        where: { provider_externalEventId: { provider: params.provider, externalEventId: params.externalEventId } },
        select: { id: true },
      });
      return { outcome: "duplicate", webhookEventId: existing.id };
    }
    throw error;
  }
}

export type MarkWebhookEventResult = { outcome: "updated" } | { outcome: "not-found" };

/** Transitions a recorded webhook event to PROCESSING, PROCESSED, or FAILED. errorMessage is only meaningful (and only set) for FAILED. */
export async function markWebhookEventStatus(
  webhookEventId: string,
  status: "PROCESSING" | "PROCESSED" | "FAILED",
  errorMessage?: string,
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<MarkWebhookEventResult> {
  const event = await db.webhookEvent.findUnique({ where: { id: webhookEventId }, select: { id: true } });
  if (!event) return { outcome: "not-found" };

  await db.webhookEvent.update({
    where: { id: event.id },
    data: {
      processingStatus: status,
      errorMessage: status === "FAILED" ? (errorMessage ?? null) : null,
      processedAt: status === "PROCESSED" ? now : undefined,
      retryCount: status === "FAILED" ? { increment: 1 } : undefined,
    },
  });

  return { outcome: "updated" };
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}
