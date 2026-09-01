import type { ExternalProvider, InternalRecordType } from "@/generated/prisma/enums";

/**
 * The interface a real provider (Follow Up Boss, Bullseye, BoldTrail)
 * implements. Nothing here is a real implementation — no class in this
 * codebase implements this interface yet, and none of these methods are
 * called by anything. This exists so a future provider is additive:
 *
 *   CRM Contact/Transaction/Task
 *       ↓
 *   Integration + ExternalSyncLink (src/lib/integrations/mutations.ts)
 *       ↓
 *   ProviderAdapter (this file)
 *       ↓
 *   Follow Up Boss / Bullseye / BoldTrail
 *
 * Core CRM code must never branch on provider ("if provider ==
 * FOLLOW_UP_BOSS, change Contact behavior") — a provider's differences
 * (auth scheme, object model, webhook signing, field names) live entirely
 * inside its own ProviderAdapter implementation. If Follow Up Boss is
 * disconnected, Contact/Transaction/Task/Document/Expense all keep
 * working exactly as they do today, because none of them import from,
 * call, or know about this interface — only the integration layer does.
 *
 * Do not assume the three providers share capabilities. A provider that
 * has no webhook support, or no "tasks" concept, is expected to reflect
 * that in its own adapter (e.g. handleWebhook throwing "not supported" or
 * syncTasks returning a result that says so) rather than this interface
 * forcing every method to be meaningful for every provider.
 */

export interface ProviderCredentialsInput {
  /** Shape is provider-specific (an API key, an OAuth token pair, ...) — deliberately untyped here; each adapter defines and validates its own. */
  [key: string]: unknown;
}

export interface ProviderConnectResult {
  outcome: "connected" | "error";
  errorMessage?: string;
}

export interface ProviderTestConnectionResult {
  outcome: "ok" | "error";
  errorMessage?: string;
}

export interface ProviderSyncResult {
  outcome: "completed" | "failed";
  syncedCount?: number;
  errorMessage?: string;
}

export interface ProviderWebhookEventInput {
  eventType: string;
  externalEventId: string;
  payload: unknown;
}

/** What a provider's raw external record maps to on the CRM side — used by mapExternalRecord, never persisted directly (see field-mapping.ts). */
export interface MappedRecordFields {
  internalRecordType: InternalRecordType;
  externalId: string;
  fields: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly provider: ExternalProvider;

  /** Establishes a real connection using provider-specific credentials, storing them encrypted (see credentials.ts) on success. Not implemented by anything yet. */
  connect(integrationId: string, credentials: ProviderCredentialsInput): Promise<ProviderConnectResult>;

  /** Tears down a connection. Must never touch CRM Contact/Transaction/Task/Document/Expense rows — only this integration's own state and its ExternalSyncLink rows. */
  disconnect(integrationId: string): Promise<void>;

  /** Verifies stored credentials still work, without performing a sync. */
  testConnection(integrationId: string): Promise<ProviderTestConnectionResult>;

  syncContacts(integrationId: string): Promise<ProviderSyncResult>;
  syncTransactions(integrationId: string): Promise<ProviderSyncResult>;
  syncTasks(integrationId: string): Promise<ProviderSyncResult>;

  /** Handles one already-recorded, not-yet-processed WebhookEvent (see webhooks.ts) — this is where a provider's own payload shape gets parsed; nothing outside the adapter needs to understand it. */
  handleWebhook(integrationId: string, event: ProviderWebhookEventInput): Promise<void>;

  /** Translates one raw external record into CRM-shaped fields, per this provider's own field mapping (see field-mapping.ts) — never a hard-coded assumption in core CRM models. */
  mapExternalRecord(internalRecordType: InternalRecordType, externalPayload: unknown): MappedRecordFields;
}
