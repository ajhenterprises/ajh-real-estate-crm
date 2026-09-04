import type { ContractPeriodDayType } from "@/generated/prisma/enums";

/**
 * Deterministic, rule-based extraction of contract fields from plain text —
 * no AI/LLM involved anywhere in this module, by explicit product
 * requirement. Every field is matched against a fixed list of label phrases
 * common to residential purchase agreements; a field that isn't matched is
 * left null rather than guessed, exactly like the manual entry form (see
 * contracts/actions.ts) leaves fields the agent hasn't typed in as null.
 * Nothing here is ever auto-confirmed — extractContractInformationAction
 * only pre-fills a draft that the agent must review on the same edit form
 * used for manual entry, then explicitly confirm before any Task or
 * TransactionEvent is created.
 */
export interface ParsedContractFields {
  buyerNames: string | null;
  sellerNames: string | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  propertyZip: string | null;
  purchasePrice: string | null;
  earnestMoneyAmount: string | null;
  contractEffectiveDate: Date | null;
  expectedClosingDate: Date | null;
  earnestMoneyDueDate: Date | null;
  inspectionPeriodDays: number | null;
  inspectionPeriodDayType: ContractPeriodDayType | null;
  financingPeriodDays: number | null;
  financingPeriodDayType: ContractPeriodDayType | null;
  appraisalPeriodDays: number | null;
  appraisalPeriodDayType: ContractPeriodDayType | null;
  titlePeriodDays: number | null;
  titlePeriodDayType: ContractPeriodDayType | null;
}

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const MONTH_NAME_PATTERN =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";

/** Exported so parse-amendment.ts's wider-window date search matches the exact same three date shapes this module does. */
export const DATE_PATTERN = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|(?:${MONTH_NAME_PATTERN})\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})`;

/** Parses one of the three date shapes DATE_PATTERN matches into a UTC date-only Date, matching this app's UTC date-storage convention. */
export function parseFlexibleDate(raw: string): Date | null {
  const value = raw.trim();

  let match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const month = Number(match[1]);
    const day = Number(match[2]);
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  match = value.match(/^([A-Za-z.]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (match) {
    const month = MONTH_NAMES[match[1].toLowerCase().replace(/\.$/, "")];
    if (month === undefined) return null;
    return new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  }

  return null;
}

function findDate(flatText: string, labels: string[]): Date | null {
  for (const label of labels) {
    const match = flatText.match(new RegExp(`${label}[^0-9A-Za-z]{0,15}${DATE_PATTERN}`, "i"));
    if (!match) continue;
    const date = parseFlexibleDate(match[1]);
    if (date) return date;
  }
  return null;
}

function findMoney(flatText: string, labels: string[]): string | null {
  for (const label of labels) {
    const match = flatText.match(new RegExp(`${label}[^0-9$]{0,20}\\$?\\s*([\\d,]+(?:\\.\\d{2})?)`, "i"));
    if (!match) continue;
    const cleaned = match[1].replace(/,/g, "");
    if (/^\d+(\.\d{1,2})?$/.test(cleaned)) return cleaned;
  }
  return null;
}

export interface Period {
  days: number;
  dayType: ContractPeriodDayType;
}

/** Looks within ~120 chars after a label for "<N> [calendar|business] day(s)", e.g. "ten (10) calendar days" or "10 business days". Exported for reuse by parse-amendment.ts — an addendum's period-change phrasing ("the Inspection Period is extended to 15 days") fits this exact same window/pattern unchanged. */
export function findPeriod(flatText: string, labels: string[]): Period | null {
  for (const label of labels) {
    const windowMatch = flatText.match(new RegExp(`${label}([\\s\\S]{0,120})`, "i"));
    if (!windowMatch) continue;
    const dayMatch = windowMatch[1].match(/(\d{1,3})\s*\)?\s*(calendar|business)?\s*days?\b/i);
    if (!dayMatch) continue;
    const days = Number(dayMatch[1]);
    if (days <= 0 || days > 3650) continue;
    const dayType: ContractPeriodDayType = dayMatch[2]?.toLowerCase() === "business" ? "BUSINESS" : "CALENDAR";
    return { days, dayType };
  }
  return null;
}

function findLineValue(lines: string[], labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`^\\s*${label}\\s*[:\\-]\\s*(.+)$`, "i");
    for (const line of lines) {
      const match = line.match(re);
      const value = match?.[1]?.trim();
      if (value && value.length > 0 && value.length < 200) return value;
    }
  }
  return null;
}

/** Splits "123 Main St, Atlanta, GA 30301" into its parts; returns the input unchanged as the address line when it doesn't match that shape. */
function splitAddress(address: string | null): { line: string | null; city: string | null; state: string | null; zip: string | null } {
  if (!address) return { line: null, city: null, state: null, zip: null };
  const match = address.match(/^(.*?),\s*([A-Za-z .]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
  if (!match) return { line: address, city: null, state: null, zip: null };
  return { line: match[1].trim(), city: match[2].trim(), state: match[3], zip: match[4] };
}

// Exported so parse-amendment.ts's addendum extraction searches for exactly
// the same field vocabulary the original-contract parser does — only the
// date search's window width differs between the two.
export const CONTRACT_EFFECTIVE_DATE_LABELS = [
  "(?:Contract\\s+)?Effective\\s+Date(?:\\s+of\\s+(?:this\\s+)?Contract)?",
  "Binding Agreement Date",
];
export const CLOSING_DATE_LABELS = ["Closing Date", "Date of Closing", "Settlement Date", "Scheduled Closing"];
export const EARNEST_MONEY_DUE_DATE_LABELS = [
  "Earnest Money(?:\\s+Deposit)?\\s+Due\\s+Date",
  "Due Date (?:of|for) Earnest Money",
];
export const INSPECTION_PERIOD_LABELS = ["Inspection Period", "Due Diligence Period", "Right to Inspect"];
export const FINANCING_PERIOD_LABELS = [
  "Financing Contingency",
  "Loan Approval Period",
  "Financing Period",
  "Mortgage Contingency",
];
export const APPRAISAL_PERIOD_LABELS = ["Appraisal Contingency", "Appraisal Period"];
export const TITLE_PERIOD_LABELS = ["Title Objection Period", "Title Examination Period", "Title Period"];

export function parseContractText(text: string): ParsedContractFields {
  const flatText = text.replace(/\s+/g, " ").trim();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rawAddress = findLineValue(lines, [
    "Property Address",
    "Address of (?:the )?Property",
    "Subject Property(?: Address)?",
  ]);
  const address = splitAddress(rawAddress);

  const inspection = findPeriod(flatText, INSPECTION_PERIOD_LABELS);
  const financing = findPeriod(flatText, FINANCING_PERIOD_LABELS);
  const appraisal = findPeriod(flatText, APPRAISAL_PERIOD_LABELS);
  const title = findPeriod(flatText, TITLE_PERIOD_LABELS);

  return {
    buyerNames: findLineValue(lines, ["Buyer(?:'s)?\\s*Name(?:s)?", "Buyer(?:\\(s\\))?", "Purchaser(?:'s)?\\s*Name(?:s)?", "Purchaser(?:\\(s\\))?"]),
    sellerNames: findLineValue(lines, ["Seller(?:'s)?\\s*Name(?:s)?", "Seller(?:\\(s\\))?"]),
    propertyAddress: address.line,
    propertyCity: address.city,
    propertyState: address.state,
    propertyZip: address.zip,
    purchasePrice: findMoney(flatText, ["Total Purchase Price", "Purchase Price", "Sales Price", "Sale Price"]),
    earnestMoneyAmount: findMoney(flatText, ["Earnest Money(?:\\s+Deposit)?(?:\\s+Amount)?", "Initial Deposit", "EMD"]),
    contractEffectiveDate: findDate(flatText, CONTRACT_EFFECTIVE_DATE_LABELS),
    expectedClosingDate: findDate(flatText, CLOSING_DATE_LABELS),
    earnestMoneyDueDate: findDate(flatText, EARNEST_MONEY_DUE_DATE_LABELS),
    inspectionPeriodDays: inspection?.days ?? null,
    inspectionPeriodDayType: inspection?.dayType ?? null,
    financingPeriodDays: financing?.days ?? null,
    financingPeriodDayType: financing?.dayType ?? null,
    appraisalPeriodDays: appraisal?.days ?? null,
    appraisalPeriodDayType: appraisal?.dayType ?? null,
    titlePeriodDays: title?.days ?? null,
    titlePeriodDayType: title?.dayType ?? null,
  };
}
