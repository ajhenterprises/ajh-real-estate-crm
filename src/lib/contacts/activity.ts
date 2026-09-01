import type { ContactActivityType } from "@/generated/prisma/enums";

/**
 * Which ContactActivityTypes represent the agent personally reaching out —
 * as opposed to system bookkeeping (CREATED, STATUS_CHANGED, SYNCED) or the
 * catch-all OTHER. This drives "last contacted" everywhere it's shown;
 * `ContactActivity.source` is a different axis entirely (lead provenance,
 * e.g. WEBSITE/BOLDTRAIL) and is never used for this.
 */
export const CONTACT_TOUCHPOINT_ACTIVITY_TYPES = ["CALL", "EMAIL", "TEXT", "SHOWING", "NOTE_ADDED"] as const;

export type ContactTouchpointType = (typeof CONTACT_TOUCHPOINT_ACTIVITY_TYPES)[number];

export function isContactTouchpointType(type: ContactActivityType): type is ContactTouchpointType {
  return (CONTACT_TOUCHPOINT_ACTIVITY_TYPES as readonly string[]).includes(type);
}

/** Fallback description text when the agent logs an activity without entering notes. */
export const CONTACT_ACTIVITY_DEFAULT_DESCRIPTIONS: Record<ContactTouchpointType, string> = {
  CALL: "Called",
  EMAIL: "Emailed",
  TEXT: "Texted",
  SHOWING: "Showing",
  NOTE_ADDED: "Note",
};

/**
 * Picks the most recent personal touchpoint from a list of activities
 * already ordered newest-first, or null if there isn't one. Operates on the
 * same activity feed the Contact detail page already fetches (ordered desc,
 * capped) rather than a second dedicated query: system activity types
 * (CREATED, STATUS_CHANGED, SYNCED) each fire at most once per contact in
 * this codebase today, so a real touchpoint — if one exists — can never be
 * pushed out of even a modestly-sized recent-activity window by them.
 */
export function getLastContactedActivity<T extends { type: ContactActivityType }>(
  activitiesNewestFirst: T[],
): T | null {
  return activitiesNewestFirst.find((activity) => isContactTouchpointType(activity.type)) ?? null;
}
