import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { createContactActivity, setContactFollowUpDate } from "@/lib/contacts/mutations";

// Skips entirely (not a failure) when TEST_DATABASE_URL isn't configured —
// see src/test/db.ts.
describe.skipIf(!hasTestDatabase)("contact mutations (DB-backed)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("setContactFollowUpDate", () => {
    it("sets a follow-up date on a contact the user owns", async () => {
      const db = getTestDb();
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);
      const date = new Date("2026-09-15T00:00:00.000Z");

      const updated = await setContactFollowUpDate(owner.id, contact.id, date, db);

      expect(updated?.nextFollowUpDate?.toISOString()).toBe(date.toISOString());
    });

    it("changes an existing follow-up date", async () => {
      const db = getTestDb();
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id, {
        nextFollowUpDate: new Date("2026-09-15T00:00:00.000Z"),
      });
      const newDate = new Date("2026-10-01T00:00:00.000Z");

      const updated = await setContactFollowUpDate(owner.id, contact.id, newDate, db);

      expect(updated?.nextFollowUpDate?.toISOString()).toBe(newDate.toISOString());
    });

    it("explicitly clears a follow-up date when passed null", async () => {
      const db = getTestDb();
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id, {
        nextFollowUpDate: new Date("2026-09-15T00:00:00.000Z"),
      });

      const updated = await setContactFollowUpDate(owner.id, contact.id, null, db);

      expect(updated?.nextFollowUpDate).toBeNull();
    });

    it("REJECTS updating another user's contact's follow-up date by id alone", async () => {
      const db = getTestDb();
      const userA = await createTestUser();
      const userB = await createTestUser();
      const userBsContact = await createTestContact(userB.id);

      const result = await setContactFollowUpDate(
        userA.id,
        userBsContact.id,
        new Date("2026-09-15T00:00:00.000Z"),
        db,
      );

      expect(result).toBeNull();

      // Prove it truly wasn't touched, not just that the function returned null.
      const unchanged = await db.contact.findUnique({ where: { id: userBsContact.id } });
      expect(unchanged?.nextFollowUpDate).toBeNull();
    });

    it("returns null for a nonexistent contact id", async () => {
      const db = getTestDb();
      const owner = await createTestUser();

      const result = await setContactFollowUpDate(owner.id, "does-not-exist", new Date(), db);

      expect(result).toBeNull();
    });
  });

  describe("createContactActivity", () => {
    it("creates an activity for a contact the user owns", async () => {
      const db = getTestDb();
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);

      const activity = await createContactActivity(owner.id, contact.id, "CALL", "Called — discussed timeline", db);

      expect(activity).not.toBeNull();
      expect(activity?.type).toBe("CALL");
      expect(activity?.description).toBe("Called — discussed timeline");
      expect(activity?.source).toBe("MANUAL");
      expect(activity?.contactId).toBe(contact.id);
    });

    it("REJECTS logging an activity against another user's contact by id alone", async () => {
      const db = getTestDb();
      const userA = await createTestUser();
      const userB = await createTestUser();
      const userBsContact = await createTestContact(userB.id);

      const result = await createContactActivity(userA.id, userBsContact.id, "CALL", "Called", db);

      expect(result).toBeNull();

      // Prove no row was created at all, not just that the function returned null.
      const activities = await db.contactActivity.findMany({ where: { contactId: userBsContact.id } });
      expect(activities).toHaveLength(0);
    });

    it("repeated logging creates independent rows with distinct timestamps, never corrupting prior entries", async () => {
      const db = getTestDb();
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);

      const first = await createContactActivity(owner.id, contact.id, "CALL", "First call", db);
      const second = await createContactActivity(owner.id, contact.id, "EMAIL", "Follow-up email", db);

      const activities = await db.contactActivity.findMany({
        where: { contactId: contact.id },
        orderBy: { createdAt: "asc" },
      });

      expect(activities).toHaveLength(2);
      expect(activities[0].id).toBe(first?.id);
      expect(activities[0].description).toBe("First call");
      expect(activities[1].id).toBe(second?.id);
      expect(activities[1].description).toBe("Follow-up email");
    });
  });
});
