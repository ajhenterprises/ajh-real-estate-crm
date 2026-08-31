import { describe, expect, it } from "vitest";
import { deriveDeadlineStatus } from "@/lib/status";

describe("deriveDeadlineStatus", () => {
  it("is on-track with no deadline", () => {
    expect(deriveDeadlineStatus(null)).toBe("on-track");
  });

  it("is attention for a past deadline", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(deriveDeadlineStatus(yesterday)).toBe("attention");
  });

  it("is upcoming for a deadline within the window", () => {
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);
    expect(deriveDeadlineStatus(inThreeDays)).toBe("upcoming");
  });

  it("is on-track for a far-future deadline", () => {
    const inThreeWeeks = new Date();
    inThreeWeeks.setDate(inThreeWeeks.getDate() + 21);
    expect(deriveDeadlineStatus(inThreeWeeks)).toBe("on-track");
  });
});
