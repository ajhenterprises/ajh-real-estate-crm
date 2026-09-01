import { describe, expect, it } from "vitest";
import {
  CONTACT_TOUCHPOINT_ACTIVITY_TYPES,
  getLastContactedActivity,
  isContactTouchpointType,
} from "@/lib/contacts/activity";

describe("isContactTouchpointType", () => {
  it("counts CALL, EMAIL, TEXT, SHOWING, and NOTE_ADDED as manual contact", () => {
    expect(CONTACT_TOUCHPOINT_ACTIVITY_TYPES).toEqual(["CALL", "EMAIL", "TEXT", "SHOWING", "NOTE_ADDED"]);
    for (const type of CONTACT_TOUCHPOINT_ACTIVITY_TYPES) {
      expect(isContactTouchpointType(type)).toBe(true);
    }
  });

  it("does not count system-generated activity types as manual contact", () => {
    expect(isContactTouchpointType("CREATED")).toBe(false);
    expect(isContactTouchpointType("STATUS_CHANGED")).toBe(false);
    expect(isContactTouchpointType("SYNCED")).toBe(false);
    expect(isContactTouchpointType("OTHER")).toBe(false);
  });
});

describe("getLastContactedActivity", () => {
  it("returns null when there are no activities", () => {
    expect(getLastContactedActivity([])).toBeNull();
  });

  it("returns null when only system activities exist", () => {
    const activities = [{ type: "STATUS_CHANGED" as const }, { type: "CREATED" as const }];
    expect(getLastContactedActivity(activities)).toBeNull();
  });

  it("picks the most recent touchpoint, skipping a more recent system entry", () => {
    // Newest-first, matching how the Contact detail page's activities feed is ordered.
    const activities = [
      { id: "newest-system", type: "STATUS_CHANGED" as const },
      { id: "most-recent-call", type: "CALL" as const },
      { id: "older-email", type: "EMAIL" as const },
      { id: "oldest-system", type: "CREATED" as const },
    ];
    expect(getLastContactedActivity(activities)?.id).toBe("most-recent-call");
  });
});
