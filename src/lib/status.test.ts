import { afterEach, describe, expect, it } from "vitest";
import { deriveDeadlineStatus, deriveFollowUpStatus, needsFollowUp } from "@/lib/status";

// A fixed "now" — midday UTC on 2026-09-15 — used throughout instead of the
// real clock, so every case below is deterministic regardless of when or in
// what timezone the suite runs. Deadline/follow-up dates are always
// UTC-midnight `Date`s, matching how date-only fields are actually stored
// (see format.ts) and how `new Date("YYYY-MM-DD")` parses them.
const NOW = new Date("2026-09-15T12:00:00.000Z");
const yesterday = new Date("2026-09-14T00:00:00.000Z");
const today = new Date("2026-09-15T00:00:00.000Z");
const tomorrow = new Date("2026-09-16T00:00:00.000Z");
const inSevenDays = new Date("2026-09-22T00:00:00.000Z"); // exactly at the upcoming window's edge
const inEightDays = new Date("2026-09-23T00:00:00.000Z"); // just past the window
const inThreeWeeks = new Date("2026-10-06T00:00:00.000Z");

describe("deriveDeadlineStatus", () => {
  it("is on-track with no deadline", () => {
    expect(deriveDeadlineStatus(null, NOW)).toBe("on-track");
  });

  it("is attention/overdue for a deadline that was yesterday", () => {
    expect(deriveDeadlineStatus(yesterday, NOW)).toBe("attention");
  });

  it("is upcoming — NOT attention — for a deadline due today (the Phase 8 same-day fix)", () => {
    // Before Phase 8, this compared the real current instant (with a
    // time-of-day) against a UTC-midnight deadline, so a deadline due
    // "today" read as overdue for the entire day. NOW is midday on the
    // 15th; `today` is UTC midnight of the 15th — due today, not overdue.
    expect(deriveDeadlineStatus(today, NOW)).toBe("upcoming");
  });

  it("is upcoming for a deadline tomorrow", () => {
    expect(deriveDeadlineStatus(tomorrow, NOW)).toBe("upcoming");
  });

  it("is upcoming exactly at the edge of the window", () => {
    expect(deriveDeadlineStatus(inSevenDays, NOW)).toBe("upcoming");
  });

  it("is on-track just past the window", () => {
    expect(deriveDeadlineStatus(inEightDays, NOW)).toBe("on-track");
  });

  it("is on-track for a far-future deadline", () => {
    expect(deriveDeadlineStatus(inThreeWeeks, NOW)).toBe("on-track");
  });
});

describe("deriveDeadlineStatus — independent of the process's local timezone", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("still treats a same-day deadline as upcoming, not attention, under a non-UTC TZ", () => {
    process.env.TZ = "Pacific/Auckland";
    expect(deriveDeadlineStatus(today, NOW)).toBe("upcoming");
  });

  it("still treats yesterday's deadline as attention under a non-UTC TZ", () => {
    process.env.TZ = "America/New_York";
    expect(deriveDeadlineStatus(yesterday, NOW)).toBe("attention");
  });
});

describe("deriveFollowUpStatus", () => {
  it("is 'none' when no follow-up date is set", () => {
    expect(deriveFollowUpStatus(null, NOW)).toBe("none");
  });

  it("is 'overdue' for a follow-up date that was yesterday", () => {
    expect(deriveFollowUpStatus(yesterday, NOW)).toBe("overdue");
  });

  it("is 'due-today' for a follow-up date today", () => {
    expect(deriveFollowUpStatus(today, NOW)).toBe("due-today");
  });

  it("is 'upcoming' for a follow-up date tomorrow, never 'overdue'", () => {
    expect(deriveFollowUpStatus(tomorrow, NOW)).toBe("upcoming");
  });
});

describe("needsFollowUp", () => {
  it("is false when there is no follow-up date — never inferred from an invented threshold", () => {
    expect(needsFollowUp(null, NOW)).toBe(false);
  });

  it("is true for an overdue follow-up date", () => {
    expect(needsFollowUp(yesterday, NOW)).toBe(true);
  });

  it("is true for a follow-up date due today", () => {
    expect(needsFollowUp(today, NOW)).toBe(true);
  });

  it("is false for a future follow-up date", () => {
    expect(needsFollowUp(tomorrow, NOW)).toBe(false);
  });
});
