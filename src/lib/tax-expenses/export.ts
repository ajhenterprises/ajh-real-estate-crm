import { contactDisplayName, formatDateWithYear } from "@/lib/format";
import { DEDUCTIBILITY_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/labels";
import type { DeductibilityStatus, PaymentMethod } from "@/generated/prisma/enums";

/**
 * CSV export. Deliberately no XLSX — no XLSX generation infrastructure
 * exists anywhere in this codebase (confirmed by inspection), and nothing
 * else in the app needs it, so CSV alone (a plain-text format every
 * spreadsheet tool already opens) covers "export for tax preparation"
 * without a new dependency. Never includes raw database ids — every
 * association is exported as a human-readable label instead.
 */

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(values: (string | number)[]): string {
  return values.map((value) => csvEscape(String(value))).join(",");
}

interface AssociationLike {
  transaction: { propertyAddress: string | null } | null;
  client: { contact: { firstName: string; lastName: string } } | null;
  contact: { firstName: string; lastName: string } | null;
}

function associationLabel(record: AssociationLike): string {
  if (record.transaction) return record.transaction.propertyAddress ?? "Transaction";
  if (record.client) return contactDisplayName(record.client.contact);
  if (record.contact) return contactDisplayName(record.contact);
  return "";
}

export interface ExpenseExportRow extends AssociationLike {
  expenseDate: Date;
  vendor: string;
  category: { name: string };
  amount: { toString(): string };
  taxYear: number;
  paymentMethod: PaymentMethod;
  businessPurpose: string | null;
  businessUsePercent: number | null;
  deductibleStatus: DeductibilityStatus;
  notes: string | null;
}

export function buildExpenseCsv(expenses: ExpenseExportRow[]): string {
  const header = toCsvRow([
    "Date",
    "Vendor",
    "Category",
    "Amount",
    "Tax Year",
    "Payment Method",
    "Business Purpose",
    "Business Use %",
    "Status",
    "Transaction/Client",
    "Notes",
  ]);
  const rows = expenses.map((expense) =>
    toCsvRow([
      formatDateWithYear(expense.expenseDate),
      expense.vendor,
      expense.category.name,
      expense.amount.toString(),
      expense.taxYear,
      PAYMENT_METHOD_LABELS[expense.paymentMethod],
      expense.businessPurpose ?? "",
      expense.businessUsePercent !== null ? `${expense.businessUsePercent}%` : "",
      DEDUCTIBILITY_STATUS_LABELS[expense.deductibleStatus],
      associationLabel(expense),
      expense.notes ?? "",
    ]),
  );
  return [header, ...rows].join("\r\n");
}

export interface TaxSummaryInput {
  taxYear: number;
  totalAmount: string;
  totalByStatus: Record<DeductibilityStatus, string>;
  categoryBreakdown: { categoryName: string; totalAmount: string; count: number }[];
  totalMiles: string;
}

/**
 * The "hand this to my CPA" export — compiled totals for one tax year, not
 * a row per expense (that's what buildExpenseCsv/buildMileageCsv are for).
 * Same reasoning as this file's header comment: CSV only, no XLSX/PDF
 * generation exists anywhere in this codebase.
 */
export function buildTaxSummaryCsv(input: TaxSummaryInput): string {
  const lines: string[] = [];
  lines.push(toCsvRow(["AJH Real Estate CRM — Tax Summary", String(input.taxYear)]));
  lines.push("");

  lines.push(toCsvRow(["Category", "Count", "Total"]));
  for (const row of input.categoryBreakdown) {
    lines.push(toCsvRow([row.categoryName, row.count, row.totalAmount]));
  }
  lines.push("");

  lines.push(toCsvRow(["Status", "Total"]));
  lines.push(toCsvRow([DEDUCTIBILITY_STATUS_LABELS.DEDUCTIBLE, input.totalByStatus.DEDUCTIBLE]));
  lines.push(toCsvRow([DEDUCTIBILITY_STATUS_LABELS.NEEDS_REVIEW, input.totalByStatus.NEEDS_REVIEW]));
  lines.push(toCsvRow([DEDUCTIBILITY_STATUS_LABELS.NOT_DEDUCTIBLE, input.totalByStatus.NOT_DEDUCTIBLE]));
  lines.push("");

  lines.push(toCsvRow(["Total Expenses", input.totalAmount]));
  lines.push(toCsvRow(["Total Business Miles", input.totalMiles]));

  return lines.join("\r\n");
}

export interface MileageExportRow extends AssociationLike {
  date: Date;
  startLocation: string;
  destination: string;
  businessPurpose: string;
  miles: { toString(): string };
  taxYear: number;
  notes: string | null;
}

export function buildMileageCsv(records: MileageExportRow[]): string {
  const header = toCsvRow(["Date", "Start", "Destination", "Purpose", "Miles", "Tax Year", "Transaction/Client", "Notes"]);
  const rows = records.map((record) =>
    toCsvRow([
      formatDateWithYear(record.date),
      record.startLocation,
      record.destination,
      record.businessPurpose,
      record.miles.toString(),
      record.taxYear,
      associationLabel(record),
      record.notes ?? "",
    ]),
  );
  return [header, ...rows].join("\r\n");
}
