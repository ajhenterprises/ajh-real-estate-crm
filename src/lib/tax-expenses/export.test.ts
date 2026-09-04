import { describe, expect, it } from "vitest";
import { buildExpenseCsv, buildMileageCsv, type ExpenseExportRow, type MileageExportRow } from "@/lib/tax-expenses/export";

function baseExpenseRow(overrides: Partial<ExpenseExportRow> = {}): ExpenseExportRow {
  return {
    expenseDate: new Date("2026-03-15T00:00:00.000Z"),
    vendor: "Acme Software",
    category: { name: "Software & Subscriptions" },
    amount: { toString: () => "79.99" },
    taxYear: 2026,
    paymentMethod: "BUSINESS_CREDIT_CARD",
    businessPurpose: "CRM subscription",
    businessUsePercent: null,
    deductibleStatus: "NEEDS_REVIEW",
    notes: null,
    transaction: null,
    contact: null,
    ...overrides,
  };
}

function baseMileageRow(overrides: Partial<MileageExportRow> = {}): MileageExportRow {
  return {
    date: new Date("2026-06-01T00:00:00.000Z"),
    startLocation: "Office",
    destination: "123 Main St",
    businessPurpose: "Showing",
    miles: { toString: () => "12.5" },
    taxYear: 2026,
    notes: null,
    transaction: null,
    contact: null,
    ...overrides,
  };
}

describe("buildExpenseCsv", () => {
  it("includes a header row and one row per expense with the required columns", () => {
    const csv = buildExpenseCsv([baseExpenseRow()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Date,Vendor,Category,Amount,Tax Year,Payment Method,Business Purpose,Business Use %,Status,Transaction/Contact,Notes",
    );
    expect(lines[1]).toContain("Acme Software");
    expect(lines[1]).toContain("Software & Subscriptions");
    expect(lines[1]).toContain("79.99");
    expect(lines[1]).toContain("2026");
    expect(lines[1]).toContain("Business Credit Card");
    expect(lines[1]).toContain("Needs Review");
  });

  it("never includes a raw database id — only human-readable labels", () => {
    const csv = buildExpenseCsv([
      baseExpenseRow({ transaction: { propertyAddress: "123 Main St" } }),
    ]);
    expect(csv).toContain("123 Main St");
    expect(csv).not.toMatch(/\bc[a-z0-9]{20,}\b/); // no cuid-shaped ids
  });

  it("shows a transaction association when present", () => {
    const csv = buildExpenseCsv([baseExpenseRow({ transaction: { propertyAddress: "456 Oak Ave" } })]);
    expect(csv).toContain("456 Oak Ave");
  });

  it("shows a contact association when present, and no association as an empty cell otherwise", () => {
    const withContact = buildExpenseCsv([baseExpenseRow({ contact: { firstName: "Jane", lastName: "Doe" } })]);
    expect(withContact).toContain("Jane Doe");

    const withNone = buildExpenseCsv([baseExpenseRow()]);
    const lines = withNone.split("\r\n");
    const cells = lines[1].split(",");
    expect(cells[cells.length - 2]).toBe(""); // Transaction/Contact column, second-to-last
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = buildExpenseCsv([baseExpenseRow({ vendor: 'Acme, "The Best" Inc.' })]);
    expect(csv).toContain('"Acme, ""The Best"" Inc."');
  });

  it("shows business-use percentage when set", () => {
    const csv = buildExpenseCsv([baseExpenseRow({ businessUsePercent: 50 })]);
    expect(csv).toContain("50%");
  });

  it("produces just the header row for an empty list", () => {
    const csv = buildExpenseCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});

describe("buildMileageCsv", () => {
  it("includes a header row and one row per trip with the required columns", () => {
    const csv = buildMileageCsv([baseMileageRow()]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Date,Start,Destination,Purpose,Miles,Tax Year,Transaction/Contact,Notes");
    expect(lines[1]).toContain("Office");
    expect(lines[1]).toContain("123 Main St");
    expect(lines[1]).toContain("Showing");
    expect(lines[1]).toContain("12.5");
    expect(lines[1]).toContain("2026");
  });

  it("shows an association label, never a raw id", () => {
    const csv = buildMileageCsv([baseMileageRow({ contact: { firstName: "Jane", lastName: "Doe" } })]);
    expect(csv).toContain("Jane Doe");
    expect(csv).not.toMatch(/\bc[a-z0-9]{20,}\b/);
  });
});
