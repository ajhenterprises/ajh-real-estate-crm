// Deliberately no `import "server-only"` — same reasoning as every other
// repo in this codebase: an optional trailing Prisma-client override
// makes these directly testable against the dedicated test database.
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ExternalProvider } from "@/generated/prisma/enums";

/**
 * Owner-scoped integration queries. CRITICAL: every select here
 * explicitly lists fields and always omits `encryptedCredentials` — this
 * is the enforcement point for "never expose integration secrets to the
 * browser/client." Any future query that genuinely needs the encrypted
 * value (to decrypt and use server-side, e.g. inside a real
 * ProviderAdapter.connect call) must be a separate, narrowly-scoped
 * function, never this one, and its result must never be passed to a
 * Server/Client Component prop.
 */

const INTEGRATION_SAFE_SELECT = {
  id: true,
  provider: true,
  status: true,
  displayName: true,
  lastSyncedAt: true,
  lastSyncError: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** The three real-estate platforms this settings page shows, per the approved UI — WEBSITE/FACEBOOK/OTHER (also valid ExternalProvider values, used elsewhere e.g. Contact.source) are not "platforms you connect" in the same sense and are not shown here. */
export const CONNECTABLE_PROVIDERS: readonly ExternalProvider[] = ["FOLLOW_UP_BOSS", "BULLSEYE", "BOLDTRAIL"];

export interface IntegrationSummary {
  id: string | null;
  provider: ExternalProvider;
  status: "DISCONNECTED" | "CONNECTED" | "ERROR";
  displayName: string | null;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

/**
 * One row per connectable provider, always — a provider with no
 * Integration row yet is represented as a synthetic "not connected"
 * entry (id: null) rather than being omitted, so the settings UI can
 * render "Follow Up Boss — Not Connected" without a real connection ever
 * having been attempted. Never shows CONNECTED unless a real row with
 * that status exists.
 */
export async function listIntegrationsForUser(
  userId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<IntegrationSummary[]> {
  const existing = await db.integration.findMany({
    where: { ownerId: userId, provider: { in: [...CONNECTABLE_PROVIDERS] } },
    select: INTEGRATION_SAFE_SELECT,
  });
  const byProvider = new Map(existing.map((integration) => [integration.provider, integration]));

  return CONNECTABLE_PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    if (row) return row;
    return {
      id: null,
      provider,
      status: "DISCONNECTED" as const,
      displayName: null,
      lastSyncedAt: null,
      lastSyncError: null,
      createdAt: null,
      updatedAt: null,
    };
  });
}

export function getIntegrationById(userId: string, integrationId: string, db: Prisma.TransactionClient = prisma) {
  return db.integration.findFirst({
    where: { id: integrationId, ownerId: userId },
    select: INTEGRATION_SAFE_SELECT,
  });
}

/** Owner-scoped sync links for one integration — for a future sync-status detail view; not wired into any UI yet. Never exposes another user's mappings. */
export function listSyncLinksForIntegration(userId: string, integrationId: string, db: Prisma.TransactionClient = prisma) {
  return db.externalSyncLink.findMany({
    where: { integrationId, ownerId: userId },
    orderBy: { updatedAt: "desc" },
  });
}
