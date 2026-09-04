import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * The 21 default expense categories, shared by every user (ExpenseCategory
 * rows with ownerId null — see prisma/schema.prisma's ExpenseCategory
 * comment). This is the live, canonical list; the migrations that created
 * (20260901180000_tax_expense_tracking) and later cleaned up
 * (20260904080000_expense_category_cleanup) these rows are historical SQL
 * snapshots of this same data and won't automatically stay in sync with
 * edits here — changing this list does not change existing database rows,
 * the same way editing any other model's field doesn't retroactively
 * change data. Adding a new default category later needs its own
 * migration.
 */
export const DEFAULT_EXPENSE_CATEGORIES: { id: string; name: string }[] = [
  { id: "expcat_advertising_marketing", name: "Marketing & Advertising" },
  { id: "expcat_signs", name: "Signs" },
  { id: "expcat_print_materials", name: "Business Cards / Print Materials" },
  { id: "expcat_photography_video", name: "Photography / Videography" },
  { id: "expcat_mls_listing_services", name: "MLS / Listing Services" },
  { id: "expcat_association_dues", name: "Association / REALTOR® Dues" },
  { id: "expcat_license_renewal", name: "License Renewal" },
  { id: "expcat_continuing_education", name: "Continuing Education" },
  { id: "expcat_brokerage_fees", name: "Brokerage Transfer / Change of Brokerage" },
  { id: "expcat_office_supplies", name: "Office / Business Supplies" },
  { id: "expcat_software_subscriptions", name: "Technology / Software" },
  { id: "expcat_phone_internet", name: "Phone / Internet" },
  { id: "expcat_vehicle_mileage", name: "Mileage / Vehicle" },
  { id: "expcat_travel", name: "Travel" },
  { id: "expcat_meals", name: "Meals" },
  { id: "expcat_client_gifts", name: "Client Gifts" },
  { id: "expcat_professional_services", name: "Professional Services" },
  { id: "expcat_insurance", name: "Insurance" },
  { id: "expcat_legal_accounting", name: "Legal / Accounting" },
  { id: "expcat_education_training", name: "Education / Training" },
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
