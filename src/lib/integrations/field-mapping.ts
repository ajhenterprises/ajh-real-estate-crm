import type { InternalRecordType } from "@/generated/prisma/enums";

/**
 * The shape a future field-mapping configuration would take, stored in
 * Integration.settings (already documented on that field as "non-secret
 * configuration only — e.g. sync frequency, field mappings" since the
 * original integration-ready phase). No UI reads or writes this yet — see
 * this task's explicit "do not build a full mapping UI yet."
 *
 * The point of defining this now is architectural: a provider's own field
 * names (FUB's `contact.firstName` vs. some other provider's differently-
 * named equivalent) belong inside that provider's adapter/configuration,
 * never as a conditional in core CRM code. A future settings UI would let
 * a user override the defaults a ProviderAdapter ships with, and both
 * would produce this same shape.
 */
export interface FieldMapping {
  internalRecordType: InternalRecordType;
  /** e.g. "firstName" on the CRM side. */
  crmField: string;
  /** The provider's own field name/path for the same concept. */
  providerField: string;
}

export interface IntegrationSettings {
  fieldMappings?: FieldMapping[];
  /** How often an eventual background sync would run, in minutes. Not enforced by anything yet — no scheduler exists for this (see README's Document Deletion & Retention section for the same "no scheduler exists" note about the unrelated document-cleanup job). */
  syncFrequencyMinutes?: number;
}
