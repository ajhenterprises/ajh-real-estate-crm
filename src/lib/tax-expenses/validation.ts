import { z } from "zod";

/**
 * Record-keeping validation only — nothing here makes a tax determination.
 * deductibleStatus is a label the user sets (see the schema comment on
 * DeductibilityStatus); this module never infers or defaults it to
 * DEDUCTIBLE, and businessUsePercent is never defaulted to 100 here either.
 */

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const PAYMENT_METHODS = ["BUSINESS_BANK_ACCOUNT", "BUSINESS_CREDIT_CARD", "PERSONAL_CARD", "CASH", "CHECK", "OTHER"] as const;
const DEDUCTIBILITY_STATUSES = ["NEEDS_REVIEW", "DEDUCTIBLE", "NOT_DEDUCTIBLE"] as const;

const dateField = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
  .transform((value) => new Date(value));

// Money as a decimal string, not a JS number, all the way to Prisma's
// Decimal column — avoids ever routing an amount through floating point.
// Two decimal places max (cents), must be positive.
const amountField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), "Enter a valid dollar amount")
  .refine((value) => Number(value) > 0, "Amount must be greater than zero");

const businessUsePercentField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .refine((value) => /^\d{1,3}$/.test(value), "Enter a whole number percentage")
    .transform((value) => Number(value))
    .refine((value) => value >= 0 && value <= 100, "Business-use percentage must be between 0 and 100")
    .optional(),
);

export const createExpenseSchema = z.object({
  expenseDate: dateField,
  amount: amountField,
  vendor: z.string().trim().min(1, "Enter a vendor or payee"),
  categoryId: z.string().trim().min(1, "Choose a category"),
  businessPurpose: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  paymentMethod: z.enum(PAYMENT_METHODS),
  deductibleStatus: z.enum(DEDUCTIBILITY_STATUSES),
  businessUsePercent: businessUsePercentField,
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  transactionId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// Reasonable ceiling to catch obvious data-entry mistakes (e.g. a typo
// dropping a decimal point) without hard-coding any actual mileage rate
// or reimbursement policy — this is a sanity bound, not a tax rule.
const MAX_REASONABLE_MILES = 10000;

const milesField = z
  .string()
  .trim()
  .min(1, "Enter miles driven")
  .refine((value) => /^\d+(\.\d)?$/.test(value), "Enter miles as a number (one decimal place)")
  .refine((value) => Number(value) > 0, "Miles must be greater than zero")
  .refine((value) => Number(value) <= MAX_REASONABLE_MILES, `Miles must be ${MAX_REASONABLE_MILES} or less`);

export const createMileageSchema = z.object({
  date: dateField,
  startLocation: z.string().trim().min(1, "Enter a starting location"),
  destination: z.string().trim().min(1, "Enter a destination"),
  businessPurpose: z.string().trim().min(1, "Enter a business purpose"),
  miles: milesField,
  notes: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  transactionId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
});

export type CreateMileageInput = z.infer<typeof createMileageSchema>;
