import { describe, expect, it } from "vitest";
import { parseContractAmendmentText } from "@/lib/contracts/parse-amendment";

describe("parseContractAmendmentText", () => {
  it("returns all-null fields for text with no recognizable date changes", () => {
    const result = parseContractAmendmentText("This addendum does not change any dates.");
    expect(result.expectedClosingDate).toBeNull();
    expect(result.earnestMoneyDueDate).toBeNull();
    expect(result.contractEffectiveDate).toBeNull();
    expect(result.inspectionPeriodDays).toBeNull();
  });

  it("extracts a closing date stated with change-verb phrasing between the label and the value", () => {
    const result = parseContractAmendmentText(
      "The Closing Date is hereby extended to 10/15/2026 by mutual agreement of the parties.",
    );
    expect(result.expectedClosingDate?.toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  it("extracts a month-name closing date with 'shall now be' phrasing", () => {
    const result = parseContractAmendmentText("The Closing Date shall now be October 15, 2026.");
    expect(result.expectedClosingDate?.toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  it("extracts an earnest money due date change", () => {
    const result = parseContractAmendmentText(
      "Earnest Money Due Date is amended and shall be 09/20/2026.",
    );
    expect(result.earnestMoneyDueDate?.toISOString().slice(0, 10)).toBe("2026-09-20");
  });

  it("extracts a contract effective date change", () => {
    const result = parseContractAmendmentText(
      "The Effective Date of this Contract is hereby changed to 09/01/2026.",
    );
    expect(result.contractEffectiveDate?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("extracts an extended inspection period, same as the original-contract parser", () => {
    const result = parseContractAmendmentText(
      "The Inspection Period is hereby extended to fifteen (15) calendar days from the Effective Date.",
    );
    expect(result.inspectionPeriodDays).toBe(15);
    expect(result.inspectionPeriodDayType).toBe("CALENDAR");
  });

  it("only extracts a date within the search window, not an unrelated later date", () => {
    const filler = "word ".repeat(30); // well past the ~80-char search window
    const result = parseContractAmendmentText(`Closing Date ${filler} Section 10, dated 01/01/2020, is unrelated.`);
    expect(result.expectedClosingDate).toBeNull();
  });
});
