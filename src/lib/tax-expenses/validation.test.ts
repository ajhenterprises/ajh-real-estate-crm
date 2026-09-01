import { describe, expect, it } from "vitest";
import { createExpenseSchema, createMileageSchema } from "@/lib/tax-expenses/validation";

const validExpense = {
  expenseDate: "2026-03-15",
  amount: "79.99",
  vendor: "Acme Software",
  categoryId: "expcat_other",
  paymentMethod: "BUSINESS_CREDIT_CARD",
  deductibleStatus: "NEEDS_REVIEW",
};

describe("createExpenseSchema", () => {
  it("accepts a fully valid expense", () => {
    const result = createExpenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: "-10.00" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: "not-a-number" });
    expect(result.success).toBe(false);
  });

  it("rejects more than two decimal places", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: "10.999" });
    expect(result.success).toBe(false);
  });

  it("accepts a whole-dollar amount", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: "10" });
    expect(result.success).toBe(true);
  });

  it("requires a vendor", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, vendor: "" });
    expect(result.success).toBe(false);
  });

  it("requires a category", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, categoryId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid date", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, expenseDate: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized deductibleStatus value", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, deductibleStatus: "DEFINITELY_DEDUCTIBLE" });
    expect(result.success).toBe(false);
  });

  describe("businessUsePercent", () => {
    it("is optional — an empty string parses to undefined, not defaulted to 100", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.businessUsePercent).toBeUndefined();
    });

    it("accepts 0", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "0" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.businessUsePercent).toBe(0);
    });

    it("accepts 100", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "100" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.businessUsePercent).toBe(100);
    });

    it("accepts a mid-range value", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "50" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.businessUsePercent).toBe(50);
    });

    it("rejects a value over 100", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "101" });
      expect(result.success).toBe(false);
    });

    it("rejects a negative value", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "-5" });
      expect(result.success).toBe(false);
    });

    it("rejects a non-integer value", () => {
      const result = createExpenseSchema.safeParse({ ...validExpense, businessUsePercent: "50.5" });
      expect(result.success).toBe(false);
    });
  });
});

const validMileage = {
  date: "2026-06-01",
  startLocation: "Office",
  destination: "123 Main St",
  businessPurpose: "Showing",
  miles: "12.5",
};

describe("createMileageSchema", () => {
  it("accepts a fully valid mileage record", () => {
    const result = createMileageSchema.safeParse(validMileage);
    expect(result.success).toBe(true);
  });

  it("rejects zero miles", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, miles: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects negative miles", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, miles: "-5" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric miles value", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, miles: "far" });
    expect(result.success).toBe(false);
  });

  it("rejects more than one decimal place", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, miles: "12.55" });
    expect(result.success).toBe(false);
  });

  it("accepts a whole-number miles value", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, miles: "12" });
    expect(result.success).toBe(true);
  });

  it("rejects an unreasonably large miles value", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, miles: "50000" });
    expect(result.success).toBe(false);
  });

  it("requires a starting location", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, startLocation: "" });
    expect(result.success).toBe(false);
  });

  it("requires a destination", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, destination: "" });
    expect(result.success).toBe(false);
  });

  it("requires a business purpose", () => {
    const result = createMileageSchema.safeParse({ ...validMileage, businessPurpose: "" });
    expect(result.success).toBe(false);
  });
});
