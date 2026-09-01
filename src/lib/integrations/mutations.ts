import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ExternalProvider, InternalRecordType } from "@/generated/prisma/enums";

/**
 * Integration foundation mutations — owner-scoped, no provider-specific
 * logic. Every function here works identically regardless of which
 * ExternalProvider is involved; the differences between Follow Up Boss,
 * Bullseye, and BoldTrail belong entirely in a future ProviderAdapter
 * implementation (see provider-adapter.ts), never here.
 *
 * Same shape as every other mutations.ts in this codebase: no
 * `import "server-only"`, optional trailing Prisma-client overrides for
 * direct testability against the dedicated test database.
 */

// ---------------------------------------------------------------------------
// Integration connection lifecycle
// ---------------------------------------------------------------------------

/**
 * Gets or creates the (owner, provider) Integration row, always starting
 * DISCONNECTED — this never claims a real connection exists. This is the
 * foundation primitive a future real "Connect" flow would call first (to
 * get an id to attach OAuth state / credentials to); nothing in this
 * phase's UI calls it, since there is no real connect flow yet. Idempotent
 * via the (ownerId, provider) unique constraint — calling it twice for the
 * same provider returns the same row, never creates a duplicate.
 */
export async function ensureIntegration(
  userId: string,
  provider: ExternalProvider,
  db: Prisma.TransactionClient = prisma,
) {
  return db.integration.upsert({
    where: { ownerId_provider: { ownerId: userId, provider } },
    create: { ownerId: userId, provider },
    update: {},
  });
}

export type DisconnectIntegrationResult = { outcome: "disconnected" } | { outcome: "not-found" };

/**
 * Disconnects an integration: flips status to DISCONNECTED and clears
 * lastSyncError (a fresh disconnect isn't "erroring" anymore). Never
 * deletes the Integration row, never touches ExternalSyncLink rows, and —
 * critically — never touches the underlying Contact/Transaction/Task/
 * Document/Expense rows those links point at. Safe to call on an
 * already-disconnected integration (idempotent no-op state-wise).
 */
export async function disconnectIntegration(
  userId: string,
  integrationId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<DisconnectIntegrationResult> {
  const integration = await db.integration.findFirst({
    where: { id: integrationId, ownerId: userId },
    select: { id: true },
  });
  if (!integration) return { outcome: "not-found" };

  await db.integration.update({
    where: { id: integration.id },
    data: { status: "DISCONNECTED", lastSyncError: null },
  });
  await recordIntegrationEvent(integration.id, "DISCONNECTED", "Integration disconnected", undefined, db);

  return { outcome: "disconnected" };
}

/** Records a connection-level audit event — see prisma/schema.prisma's IntegrationEvent comment for why this is separate from WebhookEvent. message/metadata must never contain a credential or token. */
export async function recordIntegrationEvent(
  integrationId: string,
  type: "CONNECTED" | "DISCONNECTED" | "SYNC_STARTED" | "SYNC_COMPLETED" | "SYNC_FAILED",
  message?: string,
  metadata?: Prisma.InputJsonValue,
  db: Prisma.TransactionClient = prisma,
) {
  return db.integrationEvent.create({
    data: { integrationId, type, message, metadata },
  });
}

// ---------------------------------------------------------------------------
// External ID mapping (ExternalSyncLink)
// ---------------------------------------------------------------------------

export type CreateSyncLinkResult =
  | { outcome: "created"; syncLinkId: string }
  | { outcome: "duplicate" }
  | { outcome: "integration-not-found" };

/**
 * Records that an internal record (Contact/Transaction/Task) has been
 * matched to a specific external record for a specific integration.
 * Owner-scoped via the integration (never trust a caller-supplied
 * ownerId). The (integrationId, internalRecordType, internalRecordId,
 * externalId) unique constraint is the actual duplicate-prevention
 * mechanism — this function just turns that DB-level rejection into a
 * clean, typed "duplicate" outcome instead of letting a raw constraint
 * error escape.
 */
export async function createExternalSyncLink(
  userId: string,
  params: {
    integrationId: string;
    internalRecordType: InternalRecordType;
    internalRecordId: string;
    externalId: string;
  },
  db: Prisma.TransactionClient = prisma,
): Promise<CreateSyncLinkResult> {
  const integration = await db.integration.findFirst({
    where: { id: params.integrationId, ownerId: userId },
    select: { id: true, provider: true },
  });
  if (!integration) return { outcome: "integration-not-found" };

  try {
    const link = await db.externalSyncLink.create({
      data: {
        integrationId: integration.id,
        provider: integration.provider,
        internalRecordType: params.internalRecordType,
        internalRecordId: params.internalRecordId,
        externalId: params.externalId,
        ownerId: userId,
      },
    });
    return { outcome: "created", syncLinkId: link.id };
  } catch (error) {
    const isDuplicate = isPrismaUniqueConstraintError(error);
    if (isDuplicate) return { outcome: "duplicate" };
    throw error;
  }
}

export type MarkSyncLinkResult = { outcome: "updated" } | { outcome: "not-found" };

/** Marks a sync link's outcome after an attempted sync. syncError is only meaningful (and only ever set) when status is "ERROR". */
export async function markSyncLinkStatus(
  userId: string,
  syncLinkId: string,
  status: "SYNCING" | "SYNCED" | "ERROR",
  syncError?: string,
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<MarkSyncLinkResult> {
  const link = await db.externalSyncLink.findFirst({ where: { id: syncLinkId, ownerId: userId }, select: { id: true } });
  if (!link) return { outcome: "not-found" };

  await db.externalSyncLink.update({
    where: { id: link.id },
    data: {
      syncStatus: status,
      syncError: status === "ERROR" ? (syncError ?? null) : null,
      lastSyncedAt: status === "SYNCED" ? now : undefined,
    },
  });

  return { outcome: "updated" };
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}
