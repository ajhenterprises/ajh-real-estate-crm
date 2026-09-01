import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { getIntegrationById, listIntegrationsForUser, listSyncLinksForIntegration } from "@/lib/repos/integrations";

describe.skipIf(!hasTestDatabase)("integrations repo (integration)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("listIntegrationsForUser", () => {
    it("returns all three connectable providers even when no Integration rows exist, all Not Connected", async () => {
      const owner = await createTestUser();

      const integrations = await listIntegrationsForUser(owner.id, getTestDb());

      expect(integrations.map((i) => i.provider).sort()).toEqual(["BOLDTRAIL", "BULLSEYE", "FOLLOW_UP_BOSS"].sort());
      expect(integrations.every((i) => i.status === "DISCONNECTED" && i.id === null)).toBe(true);
    });

    it("reflects a real row's status for the provider it belongs to, leaving the others as placeholders", async () => {
      const owner = await createTestUser();
      await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "FOLLOW_UP_BOSS", status: "CONNECTED", displayName: "My FUB" },
      });

      const integrations = await listIntegrationsForUser(owner.id, getTestDb());

      const fub = integrations.find((i) => i.provider === "FOLLOW_UP_BOSS");
      expect(fub?.status).toBe("CONNECTED");
      expect(fub?.displayName).toBe("My FUB");
      expect(fub?.id).not.toBeNull();

      const bullseye = integrations.find((i) => i.provider === "BULLSEYE");
      expect(bullseye?.status).toBe("DISCONNECTED");
      expect(bullseye?.id).toBeNull();
    });

    it("never shows another user's integration as connected", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      await getTestDb().integration.create({ data: { ownerId: otherUser.id, provider: "FOLLOW_UP_BOSS", status: "CONNECTED" } });

      const integrations = await listIntegrationsForUser(owner.id, getTestDb());

      const fub = integrations.find((i) => i.provider === "FOLLOW_UP_BOSS");
      expect(fub?.status).toBe("DISCONNECTED");
      expect(fub?.id).toBeNull();
    });

    it("never includes encryptedCredentials in the returned objects", async () => {
      const owner = await createTestUser();
      await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "FOLLOW_UP_BOSS", encryptedCredentials: "iv.tag.ciphertext" },
      });

      const integrations = await listIntegrationsForUser(owner.id, getTestDb());

      for (const integration of integrations) {
        expect(Object.keys(integration)).not.toContain("encryptedCredentials");
      }
    });
  });

  describe("getIntegrationById", () => {
    it("returns an owned integration without encryptedCredentials", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "BULLSEYE", encryptedCredentials: "iv.tag.ciphertext" },
      });

      const result = await getIntegrationById(owner.id, integration.id, getTestDb());

      expect(result?.id).toBe(integration.id);
      expect(Object.keys(result ?? {})).not.toContain("encryptedCredentials");
    });

    it("returns null for another user's integration", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: otherUser.id, provider: "BULLSEYE" } });

      const result = await getIntegrationById(owner.id, integration.id, getTestDb());

      expect(result).toBeNull();
    });
  });

  describe("listSyncLinksForIntegration", () => {
    it("never returns another user's sync links, even for the same integration id coincidence is impossible but ownership is still checked directly", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });
      await getTestDb().externalSyncLink.create({
        data: {
          integrationId: integration.id,
          provider: "BOLDTRAIL",
          internalRecordType: "CONTACT",
          internalRecordId: "contact-1",
          externalId: "ext-1",
          ownerId: owner.id,
        },
      });

      const asOwner = await listSyncLinksForIntegration(owner.id, integration.id, getTestDb());
      const asOtherUser = await listSyncLinksForIntegration(otherUser.id, integration.id, getTestDb());

      expect(asOwner).toHaveLength(1);
      expect(asOtherUser).toHaveLength(0);
    });
  });
});
