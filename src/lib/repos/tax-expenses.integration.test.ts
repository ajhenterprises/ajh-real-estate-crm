import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import {
  getAvailableTaxYears,
  getExpenseYearSummary,
  getMileageYearTotal,
  listExpenses,
  listMileageRecords,
} from "@/lib/repos/tax-expenses";

const OTHER_CATEGORY_ID = "expcat_other";
const SOFTWARE_CATEGORY_ID = "expcat_software_subscriptions";

describe.skipIf(!hasTestDatabase)("tax-expenses repo (integration)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  async function createExpenseRow(
    ownerId: string,
    overrides: Partial<{
      amount: string;
      taxYear: number;
      categoryId: string;
      deductibleStatus: "NEEDS_REVIEW" | "DEDUCTIBLE" | "NOT_DEDUCTIBLE";
      vendor: string;
    }> = {},
  ) {
    return getTestDb().expense.create({
      data: {
        ownerId,
        expenseDate: new Date(`${overrides.taxYear ?? 2026}-01-15T00:00:00.000Z`),
        taxYear: overrides.taxYear ?? 2026,
        amount: overrides.amount ?? "100.00",
        vendor: overrides.vendor ?? "Vendor",
        categoryId: overrides.categoryId ?? OTHER_CATEGORY_ID,
        paymentMethod: "OTHER",
        deductibleStatus: overrides.deductibleStatus ?? "NEEDS_REVIEW",
      },
    });
  }

  describe("getExpenseYearSummary", () => {
    it("sums total amount, per-status totals, and produces a category breakdown for the given year only", async () => {
      const owner = await createTestUser();
      await createExpenseRow(owner.id, { amount: "100.00", deductibleStatus: "DEDUCTIBLE", categoryId: OTHER_CATEGORY_ID });
      await createExpenseRow(owner.id, { amount: "50.00", deductibleStatus: "NEEDS_REVIEW", categoryId: SOFTWARE_CATEGORY_ID });
      await createExpenseRow(owner.id, { amount: "25.00", deductibleStatus: "NOT_DEDUCTIBLE", categoryId: SOFTWARE_CATEGORY_ID });
      // Different year — must not be included.
      await createExpenseRow(owner.id, { amount: "9999.00", taxYear: 2025 });

      const summary = await getExpenseYearSummary(owner.id, 2026, getTestDb());

      expect(summary.totalAmount).toBe("175");
      expect(summary.expenseCount).toBe(3);
      expect(summary.totalByStatus.DEDUCTIBLE).toBe("100");
      expect(summary.totalByStatus.NEEDS_REVIEW).toBe("50");
      expect(summary.totalByStatus.NOT_DEDUCTIBLE).toBe("25");
      expect(summary.categoryBreakdown).toHaveLength(2);
      const software = summary.categoryBreakdown.find((c) => c.categoryId === SOFTWARE_CATEGORY_ID);
      expect(software?.count).toBe(2);
      expect(software?.totalAmount).toBe("75");
    });

    it("never mixes another user's expenses into the total", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      await createExpenseRow(owner.id, { amount: "10.00" });
      await createExpenseRow(otherUser.id, { amount: "99999.00" });

      const summary = await getExpenseYearSummary(owner.id, 2026, getTestDb());

      expect(summary.totalAmount).toBe("10");
      expect(summary.expenseCount).toBe(1);
    });

    it("returns all-zero totals for a year with no expenses", async () => {
      const owner = await createTestUser();

      const summary = await getExpenseYearSummary(owner.id, 2030, getTestDb());

      expect(summary.totalAmount).toBe("0");
      expect(summary.expenseCount).toBe(0);
      expect(summary.categoryBreakdown).toEqual([]);
    });
  });

  describe("getMileageYearTotal", () => {
    it("sums miles for the given year and user only", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      await getTestDb().mileageRecord.create({
        data: { ownerId: owner.id, date: new Date("2026-01-01"), taxYear: 2026, startLocation: "A", destination: "B", businessPurpose: "P", miles: "10.5" },
      });
      await getTestDb().mileageRecord.create({
        data: { ownerId: owner.id, date: new Date("2026-02-01"), taxYear: 2026, startLocation: "A", destination: "B", businessPurpose: "P", miles: "5.0" },
      });
      await getTestDb().mileageRecord.create({
        data: { ownerId: owner.id, date: new Date("2025-01-01"), taxYear: 2025, startLocation: "A", destination: "B", businessPurpose: "P", miles: "999" },
      });
      await getTestDb().mileageRecord.create({
        data: { ownerId: otherUser.id, date: new Date("2026-01-01"), taxYear: 2026, startLocation: "A", destination: "B", businessPurpose: "P", miles: "999" },
      });

      const total = await getMileageYearTotal(owner.id, 2026, getTestDb());

      expect(total).toBe("15.5");
    });
  });

  describe("getAvailableTaxYears", () => {
    it("always includes the current year, plus every year with expense or mileage records, descending", async () => {
      const owner = await createTestUser();
      await createExpenseRow(owner.id, { taxYear: 2024 });
      await getTestDb().mileageRecord.create({
        data: { ownerId: owner.id, date: new Date("2023-01-01"), taxYear: 2023, startLocation: "A", destination: "B", businessPurpose: "P", miles: "1" },
      });

      const years = await getAvailableTaxYears(owner.id, getTestDb(), new Date("2026-06-01T00:00:00.000Z"));

      expect(years).toEqual([2026, 2024, 2023]);
    });
  });

  describe("listExpenses filtering", () => {
    it("filters by tax year", async () => {
      const owner = await createTestUser();
      await createExpenseRow(owner.id, { taxYear: 2026, vendor: "This Year" });
      await createExpenseRow(owner.id, { taxYear: 2025, vendor: "Last Year" });

      const results = await listExpenses(owner.id, { taxYear: 2026 }, getTestDb());

      expect(results.map((e) => e.vendor)).toEqual(["This Year"]);
    });

    it("filters by category", async () => {
      const owner = await createTestUser();
      await createExpenseRow(owner.id, { categoryId: OTHER_CATEGORY_ID, vendor: "Other" });
      await createExpenseRow(owner.id, { categoryId: SOFTWARE_CATEGORY_ID, vendor: "Software" });

      const results = await listExpenses(owner.id, { categoryId: SOFTWARE_CATEGORY_ID }, getTestDb());

      expect(results.map((e) => e.vendor)).toEqual(["Software"]);
    });

    it("filters by deductible status", async () => {
      const owner = await createTestUser();
      await createExpenseRow(owner.id, { deductibleStatus: "DEDUCTIBLE", vendor: "Confirmed" });
      await createExpenseRow(owner.id, { deductibleStatus: "NEEDS_REVIEW", vendor: "Pending" });

      const results = await listExpenses(owner.id, { status: "DEDUCTIBLE" }, getTestDb());

      expect(results.map((e) => e.vendor)).toEqual(["Confirmed"]);
    });

    it("never returns another user's expenses", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      await createExpenseRow(owner.id, { vendor: "Mine" });
      await createExpenseRow(otherUser.id, { vendor: "Theirs" });

      const results = await listExpenses(owner.id, {}, getTestDb());

      expect(results.map((e) => e.vendor)).toEqual(["Mine"]);
    });
  });

  describe("listMileageRecords filtering", () => {
    it("filters by tax year and never returns another user's records", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      await getTestDb().mileageRecord.create({
        data: { ownerId: owner.id, date: new Date("2026-01-01"), taxYear: 2026, startLocation: "A", destination: "B", businessPurpose: "Mine 2026", miles: "1" },
      });
      await getTestDb().mileageRecord.create({
        data: { ownerId: owner.id, date: new Date("2025-01-01"), taxYear: 2025, startLocation: "A", destination: "B", businessPurpose: "Mine 2025", miles: "1" },
      });
      await getTestDb().mileageRecord.create({
        data: { ownerId: otherUser.id, date: new Date("2026-01-01"), taxYear: 2026, startLocation: "A", destination: "B", businessPurpose: "Theirs", miles: "1" },
      });

      const results = await listMileageRecords(owner.id, { taxYear: 2026 }, getTestDb());

      expect(results.map((r) => r.businessPurpose)).toEqual(["Mine 2026"]);
    });
  });
});
