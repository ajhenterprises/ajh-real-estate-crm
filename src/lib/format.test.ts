import { describe, expect, it } from "vitest";
import { contactDisplayName, formatCurrency } from "@/lib/format";

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
