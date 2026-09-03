import { describe, expect, it } from "vitest";
import { parseContractText } from "@/lib/contracts/parse-fields";

describe("parseContractText", () => {
  it("returns all-null fields for text with no recognizable labels", () => {
    const result = parseContractText("This document does not contain any contract terms.");
    expect(result.contractEffectiveDate).toBeNull();
    expect(result.expectedClosingDate).toBeNull();
    expect(result.purchasePrice).toBeNull();
    expect(result.inspectionPeriodDays).toBeNull();
  });

  it("extracts slash-format dates by label", () => {
    const result = parseContractText(
      "Effective Date: 03/15/2026\nClosing Date: 04/30/2026\nEarnest Money Due Date: 03/18/2026",
    );
    expect(result.contractEffectiveDate?.toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(result.expectedClosingDate?.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(result.earnestMoneyDueDate?.toISOString().slice(0, 10)).toBe("2026-03-18");
  });

  it("extracts month-name dates", () => {
    const result = parseContractText("Contract Effective Date of Contract: March 15, 2026");
    expect(result.contractEffectiveDate?.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("extracts ISO dates", () => {
    const result = parseContractText("Settlement Date 2026-04-30");
    expect(result.expectedClosingDate?.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("extracts purchase price and earnest money, stripping $ and commas", () => {
    const result = parseContractText("Total Purchase Price: $450,000.00\nEarnest Money Deposit: $5,000");
    expect(result.purchasePrice).toBe("450000.00");
    expect(result.earnestMoneyAmount).toBe("5000");
  });

  it("extracts inspection period days and defaults to calendar when unspecified", () => {
    const result = parseContractText("Inspection Period: Buyer shall have ten (10) days from the Effective Date.");
    expect(result.inspectionPeriodDays).toBe(10);
    expect(result.inspectionPeriodDayType).toBe("CALENDAR");
  });

  it("extracts business-day periods", () => {
    const result = parseContractText("Financing Contingency: Buyer has 21 business days to obtain loan approval.");
    expect(result.financingPeriodDays).toBe(21);
    expect(result.financingPeriodDayType).toBe("BUSINESS");
  });

  it("extracts appraisal and title periods", () => {
    const result = parseContractText(
      "Appraisal Period: 14 calendar days.\nTitle Objection Period: 5 business days.",
    );
    expect(result.appraisalPeriodDays).toBe(14);
    expect(result.appraisalPeriodDayType).toBe("CALENDAR");
    expect(result.titlePeriodDays).toBe(5);
    expect(result.titlePeriodDayType).toBe("BUSINESS");
  });

  it("extracts buyer and seller names from labeled lines", () => {
    const result = parseContractText("Buyer's Name: Jane Doe\nSeller's Name: John Smith");
    expect(result.buyerNames).toBe("Jane Doe");
    expect(result.sellerNames).toBe("John Smith");
  });

  it("splits a property address line into address/city/state/zip", () => {
    const result = parseContractText("Property Address: 123 Main St, Atlanta, GA 30301");
    expect(result.propertyAddress).toBe("123 Main St");
    expect(result.propertyCity).toBe("Atlanta");
    expect(result.propertyState).toBe("GA");
    expect(result.propertyZip).toBe("30301");
  });

  it("keeps the full address line when it doesn't match the city/state/zip shape", () => {
    const result = parseContractText("Property Address: 123 Main St Unit 4");
    expect(result.propertyAddress).toBe("123 Main St Unit 4");
    expect(result.propertyCity).toBeNull();
  });
});
