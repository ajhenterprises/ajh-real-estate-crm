// Deliberately no `import "server-only"` — same reasoning as
// src/lib/repos/contacts.ts: these take an optional trailing Prisma-client
// override so they're directly testable against the dedicated test
// database (src/test/db.ts).
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { DeductibilityStatus } from "@/generated/prisma/enums";
import { listCategoriesForUser } from "@/lib/tax-expenses/categories";

// Every query here is scoped to `ownerId` for the current session user —
// same convention as every other repo in this codebase.

export type ExpenseSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface ExpenseListFilters {
  taxYear?: number;
  categoryId?: string;
  status?: DeductibilityStatus;
  search?: string;
  sort?: ExpenseSort;
}

function expenseOrderBy(sort: ExpenseSort | undefined) {
  switch (sort) {
    case "amount_desc":
      return [{ amount: "desc" as const }];
    case "amount_asc":
      return [{ amount: "asc" as const }];
    case "date_asc":
      return [{ expenseDate: "asc" as const }];
    case "date_desc":
    default:
      return [{ expenseDate: "desc" as const }];
  }
}

export function listExpenses(userId: string, filters: ExpenseListFilters = {}, db: Prisma.TransactionClient = prisma) {
  const { taxYear, categoryId, status, search, sort } = filters;
  return db.expense.findMany({
    where: {
      ownerId: userId,
      ...(taxYear !== undefined ? { taxYear } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(status ? { deductibleStatus: status } : {}),
      ...(search
        ? {
            OR: [
              { vendor: { contains: search, mode: "insensitive" as const } },
              { businessPurpose: { contains: search, mode: "insensitive" as const } },
              { notes: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: expenseOrderBy(sort),
    include: {
      category: true,
      transaction: { select: { id: true, propertyAddress: true } },
      contact: true,
      documents: { select: { id: true, filename: true, status: true } },
    },
  });
}

export function getExpenseById(userId: string, expenseId: string, db: Prisma.TransactionClient = prisma) {
  return db.expense.findFirst({
    where: { id: expenseId, ownerId: userId },
    include: {
      category: true,
      transaction: { select: { id: true, propertyAddress: true } },
      contact: true,
      documents: true,
    },
  });
}

export type MileageSort = "date_desc" | "date_asc" | "miles_desc" | "miles_asc";

export interface MileageListFilters {
  taxYear?: number;
  search?: string;
  sort?: MileageSort;
}

function mileageOrderBy(sort: MileageSort | undefined) {
  switch (sort) {
    case "miles_desc":
      return [{ miles: "desc" as const }];
    case "miles_asc":
      return [{ miles: "asc" as const }];
    case "date_asc":
      return [{ date: "asc" as const }];
    case "date_desc":
    default:
      return [{ date: "desc" as const }];
  }
}

export function listMileageRecords(
  userId: string,
  filters: MileageListFilters = {},
  db: Prisma.TransactionClient = prisma,
) {
  const { taxYear, search, sort } = filters;
  return db.mileageRecord.findMany({
    where: {
      ownerId: userId,
      ...(taxYear !== undefined ? { taxYear } : {}),
      ...(search
        ? {
            OR: [
              { startLocation: { contains: search, mode: "insensitive" as const } },
              { destination: { contains: search, mode: "insensitive" as const } },
              { businessPurpose: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: mileageOrderBy(sort),
    include: {
      transaction: { select: { id: true, propertyAddress: true } },
      contact: true,
    },
  });
}

export function getMileageRecordById(userId: string, mileageRecordId: string, db: Prisma.TransactionClient = prisma) {
  return db.mileageRecord.findFirst({ where: { id: mileageRecordId, ownerId: userId } });
}

export interface ExpenseCategoryBreakdown {
  categoryId: string;
  categoryName: string;
  totalAmount: string;
  count: number;
}

export interface ExpenseYearSummary {
  totalAmount: string;
  totalByStatus: Record<DeductibilityStatus, string>;
  expenseCount: number;
  categoryBreakdown: ExpenseCategoryBreakdown[];
}

/**
 * Dashboard totals for one tax year: overall amount, per-status amounts
 * (Deductible/Needs Review/Not Deductible — user-entered labels, never
 * inferred here), and a per-category breakdown.
 *
 * The breakdown always includes every category available to this user
 * (every default plus their own custom ones) — not just categories with
 * an expense this year — so the full category structure is visible even
 * when most of it is $0 for the period being viewed; categories with
 * activity sort first by total (highest first), unused ones follow
 * alphabetically.
 */
export async function getExpenseYearSummary(
  userId: string,
  taxYear: number,
  db: Prisma.TransactionClient = prisma,
): Promise<ExpenseYearSummary> {
  const [totalAgg, statusGroups, categoryGroups, allCategories] = await Promise.all([
    db.expense.aggregate({ where: { ownerId: userId, taxYear }, _sum: { amount: true }, _count: true }),
    db.expense.groupBy({ by: ["deductibleStatus"], where: { ownerId: userId, taxYear }, _sum: { amount: true } }),
    db.expense.groupBy({ by: ["categoryId"], where: { ownerId: userId, taxYear }, _sum: { amount: true }, _count: true }),
    listCategoriesForUser(userId, db),
  ]);

  const totalByStatus: Record<DeductibilityStatus, string> = {
    NEEDS_REVIEW: "0",
    DEDUCTIBLE: "0",
    NOT_DEDUCTIBLE: "0",
  };
  for (const group of statusGroups) {
    totalByStatus[group.deductibleStatus] = (group._sum.amount ?? 0).toString();
  }

  const activityByCategoryId = new Map(
    categoryGroups.map((group) => [group.categoryId, { totalAmount: (group._sum.amount ?? 0).toString(), count: group._count }]),
  );

  const categoryBreakdown = allCategories
    .map((category) => {
      const activity = activityByCategoryId.get(category.id);
      return {
        categoryId: category.id,
        categoryName: category.name,
        totalAmount: activity?.totalAmount ?? "0",
        count: activity?.count ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.count > 0 && b.count > 0) return Number(b.totalAmount) - Number(a.totalAmount);
      if (a.count !== b.count) return a.count > 0 ? -1 : 1;
      return a.categoryName.localeCompare(b.categoryName);
    });

  return {
    totalAmount: (totalAgg._sum.amount ?? 0).toString(),
    totalByStatus,
    expenseCount: totalAgg._count,
    categoryBreakdown,
  };
}

export async function getMileageYearTotal(userId: string, taxYear: number, db: Prisma.TransactionClient = prisma): Promise<string> {
  const agg = await db.mileageRecord.aggregate({ where: { ownerId: userId, taxYear }, _sum: { miles: true } });
  return (agg._sum.miles ?? 0).toString();
}

/**
 * Every tax year worth showing in the year picker: the current year
 * (always present, even with zero records, so a brand-new user isn't
 * dropped into an empty picker) plus every year that actually has an
 * expense or mileage record, descending. `now` is injectable for
 * deterministic tests — same convention as src/lib/format.ts's
 * startOfTodayUTC.
 */
export async function getAvailableTaxYears(
  userId: string,
  db: Prisma.TransactionClient = prisma,
  now: Date = new Date(),
): Promise<number[]> {
  const [expenseYears, mileageYears] = await Promise.all([
    db.expense.findMany({ where: { ownerId: userId }, select: { taxYear: true }, distinct: ["taxYear"] }),
    db.mileageRecord.findMany({ where: { ownerId: userId }, select: { taxYear: true }, distinct: ["taxYear"] }),
  ]);
  const years = new Set<number>([
    now.getUTCFullYear(),
    ...expenseYears.map((e) => e.taxYear),
    ...mileageYears.map((m) => m.taxYear),
  ]);
  return Array.from(years).sort((a, b) => b - a);
}
