import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { getContactById } from "@/lib/repos/contacts";

describe.skipIf(!hasTestDatabase)("getContactById (DB-backed, owner-scoped)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("returns a contact owned by the requesting user", async () => {
    const db = getTestDb();
    const owner = await createTestUser();
    const contact = await createTestContact(owner.id, { firstName: "Jane", lastName: "Doe" });

    const found = await getContactById(owner.id, contact.id, db);

    expect(found?.id).toBe(contact.id);
    expect(found?.firstName).toBe("Jane");
  });

  it("REJECTS reading another user's contact by id alone", async () => {
    const db = getTestDb();
    const userA = await createTestUser();
    const userB = await createTestUser();
    const userBsContact = await createTestContact(userB.id);

    const found = await getContactById(userA.id, userBsContact.id, db);

    expect(found).toBeNull();
  });

  it("returns null for a contact id that doesn't exist at all", async () => {
    const db = getTestDb();
    const userA = await createTestUser();

    const found = await getContactById(userA.id, "does-not-exist", db);

    expect(found).toBeNull();
  });
});
