import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { contactDisplayName, endOfTodayUTC, formatCurrency, startOfTodayUTC } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats a numeric string as USD with no decimals", () => {
    expect(formatCurrency("450000")).toBe("$450,000");
  });

  it("returns null for null/undefined input", () => {
    expect(formatCurrency(null)).toBeNull();
    expect(formatCurrency(undefined)).toBeNull();
  });
});

describe("contactDisplayName", () => {
  it("joins first and last name", () => {
    expect(contactDisplayName({ firstName: "Jane", lastName: "Doe" })).toBe("Jane Doe");
  });
});

// These use a fixed reference instant (the optional `now` parameter) rather
// than the real clock, so they're deterministic regardless of when the
// suite runs — and the TZ-override block below proves the result is also
// independent of the *process's* configured local timezone, which is the
// actual Phase 8 fix: these boundaries must anchor to UTC, not whatever
// timezone happens to be configured on the host running the app.
describe("startOfTodayUTC / endOfTodayUTC", () => {
  it("returns UTC midnight of the given instant's UTC day", () => {
    const midDay = new Date("2026-09-15T15:30:00.000Z");
    expect(startOfTodayUTC(midDay).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("stays on the same UTC day for an instant just before UTC midnight", () => {
    const almostMidnight = new Date("2026-09-15T23:59:59.999Z");
    expect(startOfTodayUTC(almostMidnight).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("rolls over to the new UTC day exactly at UTC midnight", () => {
    const exactlyMidnight = new Date("2026-09-16T00:00:00.000Z");
    expect(startOfTodayUTC(exactlyMidnight).toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });

  it("endOfTodayUTC is exactly one day after startOfTodayUTC", () => {
    const midDay = new Date("2026-09-15T15:30:00.000Z");
    expect(endOfTodayUTC(midDay).toISOString()).toBe("2026-09-16T00:00:00.000Z");
  });
});

describe("startOfTodayUTC / endOfTodayUTC — independent of the process's local timezone", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("still anchors to UTC midnight when the process runs in a US timezone, west of UTC", () => {
    process.env.TZ = "America/New_York";
    // 2026-09-15T02:00:00Z is 2026-09-14, 10pm in New York (UTC-4 in September) —
    // a local-time boundary would incorrectly consider this "the 14th."
    const earlyUtcMorning = new Date("2026-09-15T02:00:00.000Z");
    expect(startOfTodayUTC(earlyUtcMorning).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });

  it("still anchors to UTC midnight when the process runs in a timezone east of UTC", () => {
    process.env.TZ = "Pacific/Auckland";
    // 2026-09-15T22:00:00Z is already 2026-09-16 in Auckland (UTC+12/+13) —
    // a local-time boundary would incorrectly consider this "the 16th."
    const lateUtcEvening = new Date("2026-09-15T22:00:00.000Z");
    expect(startOfTodayUTC(lateUtcEvening).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });
});

describe("startOfTodayUTC — regression guard against the pre-Phase-8 local-time bug", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Pacific/Auckland";
  });

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("does NOT reproduce local-time `setHours(0,0,0,0)` boundary behavior", () => {
    const lateUtcEvening = new Date("2026-09-15T22:00:00.000Z");

    // What the old, buggy implementation would have produced: local
    // midnight of whatever day the host's configured timezone considers
    // "now" to be — which, in Auckland at this instant, is already the 16th.
    const buggyLocalBoundary = new Date(lateUtcEvening);
    buggyLocalBoundary.setHours(0, 0, 0, 0);

    expect(startOfTodayUTC(lateUtcEvening).getTime()).not.toBe(buggyLocalBoundary.getTime());
    expect(startOfTodayUTC(lateUtcEvening).toISOString()).toBe("2026-09-15T00:00:00.000Z");
  });
});
