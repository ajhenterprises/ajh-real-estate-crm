import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { getContactsNeedingFollowUp } from "@/lib/repos/dashboard";

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setHours(12, 0, 0, 0); // midday, so this is unambiguously "today" regardless of exact test run time
  date.setDate(date.getDate() + days);
  return date;
}

describe.skipIf(!hasTestDatabase)("getContactsNeedingFollowUp (DB-backed, owner-scoped)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("includes only the requesting user's own contacts, never another owner's", async () => {
    const db = getTestDb();
    const userA = await createTestUser();
    const userB = await createTestUser();
    await createTestContact(userA.id, { firstName: "Mine", nextFollowUpDate: daysFromNow(-1) });
    await createTestContact(userB.id, { firstName: "TheirsNotMine", nextFollowUpDate: daysFromNow(-1) });

    const results = await getContactsNeedingFollowUp(userA.id, db);

    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe("Mine");
  });

  it("includes an overdue follow-up and excludes a future one, for the same owner", async () => {
    const db = getTestDb();
    const owner = await createTestUser();
    await createTestContact(owner.id, { firstName: "Overdue", nextFollowUpDate: daysFromNow(-3) });
    await createTestContact(owner.id, { firstName: "Future", nextFollowUpDate: daysFromNow(7) });
    await createTestContact(owner.id, { firstName: "NoFollowUp", nextFollowUpDate: null });

    const results = await getContactsNeedingFollowUp(owner.id, db);
    const names = results.map((c) => c.firstName);

    expect(names).toContain("Overdue");
    expect(names).not.toContain("Future");
    expect(names).not.toContain("NoFollowUp");
  });

  it("orders the most overdue contact first", async () => {
    const db = getTestDb();
    const owner = await createTestUser();
    await createTestContact(owner.id, { firstName: "ThreeDaysOverdue", nextFollowUpDate: daysFromNow(-3) });
    await createTestContact(owner.id, { firstName: "TenDaysOverdue", nextFollowUpDate: daysFromNow(-10) });

    const results = await getContactsNeedingFollowUp(owner.id, db);

    expect(results[0].firstName).toBe("TenDaysOverdue");
    expect(results[1].firstName).toBe("ThreeDaysOverdue");
  });
});
