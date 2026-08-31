import { describe, expect, it } from "vitest";
import { calculateContractEvents, type ContractInformationDates } from "@/lib/contracts/dates";

const base: ContractInformationDates = {
  contractEffectiveDate: null,
  expectedClosingDate: null,
  earnestMoneyDueDate: null,
  inspectionPeriodDays: null,
  inspectionPeriodDayType: null,
  financingPeriodDays: null,
  financingPeriodDayType: null,
  appraisalPeriodDays: null,
  appraisalPeriodDayType: null,
  titlePeriodDays: null,
  titlePeriodDayType: null,
};

describe("calculateContractEvents", () => {
  it("produces nothing when no information is entered", () => {
    expect(calculateContractEvents(base)).toEqual([]);
  });

  it("matches the spec's worked example: Aug 31 effective + 7 calendar days = Sep 7", () => {
    const events = calculateContractEvents({
      ...base,
      contractEffectiveDate: new Date("2026-08-31T00:00:00.000Z"),
      inspectionPeriodDays: 7,
      inspectionPeriodDayType: "CALENDAR",
    });

    const end = events.find((e) => e.eventType === "INSPECTION_PERIOD_END");
    expect(end).toBeDefined();
    expect(end?.date.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect(end?.isCalculated).toBe(true);
    expect(end?.calculationBasis).toBe("Contract Effective Date + 7 calendar days");
  });

  it("counts only weekdays for business-day periods, not counting the anchor day", () => {
    // Monday, August 31 2026 + 5 business days -> the following Monday, Sep 7
    const events = calculateContractEvents({
      ...base,
      contractEffectiveDate: new Date("2026-08-31T00:00:00.000Z"),
      financingPeriodDays: 5,
      financingPeriodDayType: "BUSINESS",
    });

    const deadline = events.find((e) => e.eventType === "FINANCING_DEADLINE");
    expect(deadline?.date.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect(deadline?.calculationBasis).toBe("Contract Effective Date + 5 business days");
  });

  it("does not invent a due date for a period with days but no calendar/business selection", () => {
    const events = calculateContractEvents({
      ...base,
      contractEffectiveDate: new Date("2026-08-31T00:00:00.000Z"),
      appraisalPeriodDays: 14,
      appraisalPeriodDayType: null,
    });

    expect(events.find((e) => e.eventType === "APPRAISAL_DEADLINE")).toBeUndefined();
  });

  it("does not calculate any period without a contract effective date", () => {
    const events = calculateContractEvents({
      ...base,
      inspectionPeriodDays: 7,
      inspectionPeriodDayType: "CALENDAR",
    });

    expect(events).toEqual([]);
  });

  it("passes directly-entered dates through uncalculated", () => {
    const closing = new Date("2026-10-15T00:00:00.000Z");
    const events = calculateContractEvents({ ...base, expectedClosingDate: closing });

    expect(events).toEqual([
      {
        eventType: "CLOSING_DATE",
        title: "Closing Date",
        date: closing,
        isCalculated: false,
        calculationBasis: null,
      },
    ]);
  });

  it("includes the period start alongside the calculated end", () => {
    const events = calculateContractEvents({
      ...base,
      contractEffectiveDate: new Date("2026-08-31T00:00:00.000Z"),
      inspectionPeriodDays: 10,
      inspectionPeriodDayType: "CALENDAR",
    });

    const start = events.find((e) => e.eventType === "INSPECTION_PERIOD_START");
    expect(start?.isCalculated).toBe(false);
    expect(start?.date.toISOString().slice(0, 10)).toBe("2026-08-31");
  });
});
