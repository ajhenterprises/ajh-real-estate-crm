import type { ContractPeriodDayType, TransactionEventType } from "@/generated/prisma/enums";
import { TRANSACTION_EVENT_TYPE_LABELS } from "@/lib/labels";

export interface ContractEventCandidate {
  eventType: TransactionEventType;
  title: string;
  date: Date;
  isCalculated: boolean;
  calculationBasis: string | null;
}

/** Calendar-day addition, UTC-anchored to match how this app stores every date-only field (see toDateInputValue). */
function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Business-day addition: Monday–Friday only. Does NOT exclude holidays —
 * there is no holiday calendar in this application, and silently guessing
 * one would be exactly the kind of invented legal interpretation this
 * phase must avoid. Every UI surface that shows a business-day calculation
 * discloses this definition (see CONTRACT_PERIOD_DAY_TYPE_LABELS).
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const dayOfWeek = result.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) remaining--;
  }
  return result;
}

function applyPeriod(anchor: Date, days: number, dayType: ContractPeriodDayType): Date {
  return dayType === "BUSINESS" ? addBusinessDays(anchor, days) : addCalendarDays(anchor, days);
}

function periodLabel(days: number, dayType: ContractPeriodDayType): string {
  const unit = dayType === "BUSINESS" ? "business" : "calendar";
  return `${days} ${unit} day${days === 1 ? "" : "s"}`;
}

export interface ContractInformationDates {
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

/**
 * Turns confirmed contract information into the transaction events it
 * supports — nothing more. Every candidate here requires the specific
 * inputs that produce it; there are no fallback/default lengths. A period
 * with a day count but no calendar/business selection produces nothing,
 * on the same principle: an ambiguous rule is not a rule.
 */
export function calculateContractEvents(info: ContractInformationDates): ContractEventCandidate[] {
  const candidates: ContractEventCandidate[] = [];
  const title = (type: TransactionEventType) => TRANSACTION_EVENT_TYPE_LABELS[type];

  if (info.contractEffectiveDate) {
    candidates.push({
      eventType: "CONTRACT_EFFECTIVE",
      title: title("CONTRACT_EFFECTIVE"),
      date: info.contractEffectiveDate,
      isCalculated: false,
      calculationBasis: null,
    });
  }

  if (info.expectedClosingDate) {
    candidates.push({
      eventType: "CLOSING_DATE",
      title: title("CLOSING_DATE"),
      date: info.expectedClosingDate,
      isCalculated: false,
      calculationBasis: null,
    });
  }

  if (info.earnestMoneyDueDate) {
    candidates.push({
      eventType: "EARNEST_MONEY_DUE",
      title: title("EARNEST_MONEY_DUE"),
      date: info.earnestMoneyDueDate,
      isCalculated: false,
      calculationBasis: null,
    });
  }

  const periods: {
    days: number | null;
    dayType: ContractPeriodDayType | null;
    endType: TransactionEventType;
    startType?: TransactionEventType;
  }[] = [
    {
      days: info.inspectionPeriodDays,
      dayType: info.inspectionPeriodDayType,
      endType: "INSPECTION_PERIOD_END",
      startType: "INSPECTION_PERIOD_START",
    },
    { days: info.financingPeriodDays, dayType: info.financingPeriodDayType, endType: "FINANCING_DEADLINE" },
    { days: info.appraisalPeriodDays, dayType: info.appraisalPeriodDayType, endType: "APPRAISAL_DEADLINE" },
    { days: info.titlePeriodDays, dayType: info.titlePeriodDayType, endType: "TITLE_DEADLINE" },
  ];

  if (info.contractEffectiveDate) {
    for (const period of periods) {
      if (period.days === null || period.dayType === null) continue;

      if (period.startType) {
        candidates.push({
          eventType: period.startType,
          title: title(period.startType),
          date: info.contractEffectiveDate,
          isCalculated: false,
          calculationBasis: null,
        });
      }

      candidates.push({
        eventType: period.endType,
        title: title(period.endType),
        date: applyPeriod(info.contractEffectiveDate, period.days, period.dayType),
        isCalculated: true,
        calculationBasis: `${title("CONTRACT_EFFECTIVE")} + ${periodLabel(period.days, period.dayType)}`,
      });
    }
  }

  return candidates;
}
