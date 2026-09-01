import { describe, expect, it } from "vitest";
import { deriveDeadlineStatus, deriveFollowUpStatus, needsFollowUp } from "@/lib/status";

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

describe("deriveFollowUpStatus", () => {
  it("is 'none' when no follow-up date is set", () => {
    expect(deriveFollowUpStatus(null)).toBe("none");
  });

  it("is 'overdue' for a past follow-up date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(deriveFollowUpStatus(yesterday)).toBe("overdue");
  });

  it("is 'due-today' for a follow-up date earlier today", () => {
    const earlierToday = new Date();
    earlierToday.setHours(0, 0, 1, 0);
    expect(deriveFollowUpStatus(earlierToday)).toBe("due-today");
  });

  it("is 'upcoming' for a future follow-up date, never 'overdue'", () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    expect(deriveFollowUpStatus(nextWeek)).toBe("upcoming");
  });
});

describe("needsFollowUp", () => {
  it("is false when there is no follow-up date — never inferred from an invented threshold", () => {
    expect(needsFollowUp(null)).toBe(false);
  });

  it("is true for an overdue follow-up date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(needsFollowUp(yesterday)).toBe(true);
  });

  it("is true for a follow-up date due today", () => {
    const earlierToday = new Date();
    earlierToday.setHours(0, 0, 1, 0);
    expect(needsFollowUp(earlierToday)).toBe(true);
  });

  it("is false for a future follow-up date", () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    expect(needsFollowUp(nextWeek)).toBe(false);
  });
});
