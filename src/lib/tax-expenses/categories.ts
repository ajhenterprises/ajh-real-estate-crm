import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * The 20 default expense categories, shared by every user (ExpenseCategory
 * rows with ownerId null — see prisma/schema.prisma's ExpenseCategory
 * comment). This is the live, canonical list; the migration that first
 * created these rows (prisma/migrations/20260901180000_tax_expense_tracking)
 * is a historical SQL snapshot of the same data and won't automatically
 * stay in sync with edits here — changing this list does not change
 * existing database rows, the same way editing any other model's field
 * doesn't retroactively change data. Adding a new default category later
 * needs its own migration.
 */
export const DEFAULT_EXPENSE_CATEGORIES: { id: string; name: string }[] = [
  { id: "expcat_advertising_marketing", name: "Advertising & Marketing" },
  { id: "expcat_mls_association", name: "MLS / Association" },
  { id: "expcat_brokerage_fees", name: "Brokerage Fees" },
  { id: "expcat_lead_generation", name: "Lead Generation" },
  { id: "expcat_client_gifts", name: "Client Gifts" },
  { id: "expcat_signs_printing", name: "Signs & Printing" },
  { id: "expcat_photography_video", name: "Photography / Video" },
  { id: "expcat_software_subscriptions", name: "Software & Subscriptions" },
  { id: "expcat_office_supplies", name: "Office Supplies" },
  { id: "expcat_phone_internet", name: "Phone / Internet" },
  { id: "expcat_education_training", name: "Education & Training" },
  { id: "expcat_professional_services", name: "Professional Services" },
  { id: "expcat_insurance", name: "Insurance" },
  { id: "expcat_travel", name: "Travel" },
  { id: "expcat_meals", name: "Meals" },
  { id: "expcat_vehicle_mileage", name: "Vehicle / Mileage" },
  { id: "expcat_postage_shipping", name: "Postage & Shipping" },
  { id: "expcat_bank_fees", name: "Bank / Payment Processing Fees" },
  { id: "expcat_home_office", name: "Home Office" },
  { id: "expcat_other", name: "Other" },
];

/**
 * Re-inserts the default categories. Only ever safe to call against an
 * empty expense_categories table (e.g. immediately after
 * src/test/db.ts's resetTestDatabase truncates it) — this does not
 * deduplicate against existing rows itself. Application code never calls
 * this; the real defaults are seeded once, by the migration above.
 */
export async function seedDefaultExpenseCategoriesForTest(db: Prisma.TransactionClient = prisma): Promise<void> {
  await db.expenseCategory.createMany({
    data: DEFAULT_EXPENSE_CATEGORIES.map((category) => ({ ...category, isSystemDefault: true, ownerId: null })),
  });
}

/**
 * Every category a user can choose from: the shared defaults plus any
 * custom categories they've created themselves. Sorted with defaults
 * first (in their fixed list order), then custom categories alphabetically
 * — keeps the dropdown predictable rather than reshuffling as custom
 * categories are added.
 */
export async function listCategoriesForUser(userId: string, db: Prisma.TransactionClient = prisma) {
  const categories = await db.expenseCategory.findMany({
    where: { OR: [{ ownerId: null }, { ownerId: userId }] },
  });
  const defaultOrder = new Map(DEFAULT_EXPENSE_CATEGORIES.map((category, index) => [category.id, index]));
  return categories.sort((a, b) => {
    const aIsDefault = defaultOrder.has(a.id);
    const bIsDefault = defaultOrder.has(b.id);
    if (aIsDefault && bIsDefault) return defaultOrder.get(a.id)! - defaultOrder.get(b.id)!;
    if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
