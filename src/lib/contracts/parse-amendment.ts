import type { ContractPeriodDayType } from "@/generated/prisma/enums";
import {
  APPRAISAL_PERIOD_LABELS,
  CLOSING_DATE_LABELS,
  CONTRACT_EFFECTIVE_DATE_LABELS,
  DATE_PATTERN,
  EARNEST_MONEY_DUE_DATE_LABELS,
  FINANCING_PERIOD_LABELS,
  findPeriod,
  INSPECTION_PERIOD_LABELS,
  parseFlexibleDate,
  TITLE_PERIOD_LABELS,
} from "@/lib/contracts/parse-fields";

/**
 * Deterministic, rule-based extraction of DATE changes from an addendum's
 * text — same no-AI philosophy and the same field-label vocabulary as
 * parse-fields.ts's original-contract parser, deliberately scoped to dates
 * and periods only (an addendum's price/party changes aren't extracted
 * here). The one real difference from the original parser: this searches a
 * wider window after each label, because an addendum states a changed date
 * as "the Closing Date is hereby extended to ___" or "shall now be ___"
 * rather than putting the label immediately next to the value the way the
 * original contract typically does.
 *
 * Like parse-fields.ts, a field this doesn't confidently match is left
 * null rather than guessed — extractContractAmendmentAction only proposes
 * what this finds as a change; nothing here is ever auto-applied without
 * the agent reviewing and re-confirming.
 */
export interface ParsedContractAmendment {
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

const AMENDMENT_DATE_WINDOW = 80;

/** Looks within ~80 chars after a label for the first date-shaped substring, rather than requiring the date immediately after the label like parse-fields.ts's findDate does. */
function findAmendedDate(flatText: string, labels: string[]): Date | null {
  for (const label of labels) {
    const windowMatch = flatText.match(new RegExp(`${label}([\\s\\S]{0,${AMENDMENT_DATE_WINDOW}})`, "i"));
    if (!windowMatch) continue;
    const dateMatch = windowMatch[1].match(new RegExp(DATE_PATTERN, "i"));
    if (!dateMatch) continue;
    const date = parseFlexibleDate(dateMatch[1]);
    if (date) return date;
  }
  return null;
}

export function parseContractAmendmentText(text: string): ParsedContractAmendment {
  const flatText = text.replace(/\s+/g, " ").trim();

  const inspection = findPeriod(flatText, INSPECTION_PERIOD_LABELS);
  const financing = findPeriod(flatText, FINANCING_PERIOD_LABELS);
  const appraisal = findPeriod(flatText, APPRAISAL_PERIOD_LABELS);
  const title = findPeriod(flatText, TITLE_PERIOD_LABELS);

  return {
    contractEffectiveDate: findAmendedDate(flatText, CONTRACT_EFFECTIVE_DATE_LABELS),
    expectedClosingDate: findAmendedDate(flatText, CLOSING_DATE_LABELS),
    earnestMoneyDueDate: findAmendedDate(flatText, EARNEST_MONEY_DUE_DATE_LABELS),
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
