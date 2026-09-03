import type { ContactSource, ExternalProvider } from "@/generated/prisma/enums";

/**
 * Single source of truth for how a lead source / integration provider is
 * labeled in the UI. Every provider the CRM knows about — connected or
 * not — has an entry here; adding a new one (e.g. a different IDX vendor)
 * is a one-line addition plus a schema enum value, not a redesign.
 */
export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  MANUAL: "Manual",
  BOLDTRAIL: "BoldTrail",
  FOLLOW_UP_BOSS: "Follow Up Boss",
  BULLSEYE: "Bullseye",
  WEBSITE: "Website",
  FACEBOOK: "Facebook",
  ZILLOW: "Zillow",
  REALTOR_COM: "Realtor.com",
  REFERRAL: "Referral",
  OTHER: "Other",
};

/**
 * Providers this label map does not cover are, by construction, not
 * syncable — ExternalProvider only lists third-party systems, unlike
 * ContactSource which also covers internal origins (manual, referral).
 */
export const EXTERNAL_PROVIDER_LABELS: Record<ExternalProvider, string> = {
  BOLDTRAIL: "BoldTrail",
  FOLLOW_UP_BOSS: "Follow Up Boss",
  BULLSEYE: "Bullseye",
  WEBSITE: "Website",
  FACEBOOK: "Facebook",
  OTHER: "Other",
};
