import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import {
  createExternalSyncLink,
  disconnectIntegration,
  ensureIntegration,
  markSyncLinkStatus,
  recordIntegrationEvent,
} from "@/lib/integrations/mutations";

describe.skipIf(!hasTestDatabase)("integration mutations (integration)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("ensureIntegration", () => {
    it("creates a DISCONNECTED integration for a provider that has none yet", async () => {
      const owner = await createTestUser();

      const integration = await ensureIntegration(owner.id, "FOLLOW_UP_BOSS", getTestDb());

      expect(integration.ownerId).toBe(owner.id);
      expect(integration.provider).toBe("FOLLOW_UP_BOSS");
      expect(integration.status).toBe("DISCONNECTED");
    });

    it("never creates a duplicate row for the same owner and provider — idempotent", async () => {
      const owner = await createTestUser();

      const first = await ensureIntegration(owner.id, "BULLSEYE", getTestDb());
      const second = await ensureIntegration(owner.id, "BULLSEYE", getTestDb());

      expect(second.id).toBe(first.id);
      const count = await getTestDb().integration.count({ where: { ownerId: owner.id, provider: "BULLSEYE" } });
      expect(count).toBe(1);
    });

    it("allows the same provider for two different owners, each getting their own row", async () => {
      const ownerA = await createTestUser();
      const ownerB = await createTestUser();

      const a = await ensureIntegration(ownerA.id, "BOLDTRAIL", getTestDb());
      const b = await ensureIntegration(ownerB.id, "BOLDTRAIL", getTestDb());

      expect(a.id).not.toBe(b.id);
    });
  });

  describe("disconnectIntegration", () => {
    it("flips a connected integration to DISCONNECTED and clears the last error", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "FOLLOW_UP_BOSS", status: "CONNECTED", lastSyncError: "rate limited" },
      });

      const result = await disconnectIntegration(owner.id, integration.id, getTestDb());

      expect(result).toEqual({ outcome: "disconnected" });
      const row = await getTestDb().integration.findUnique({ where: { id: integration.id } });
      expect(row?.status).toBe("DISCONNECTED");
      expect(row?.lastSyncError).toBeNull();
    });

    it("records a DISCONNECTED IntegrationEvent", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "FOLLOW_UP_BOSS", status: "CONNECTED" },
      });

      await disconnectIntegration(owner.id, integration.id, getTestDb());

      const events = await getTestDb().integrationEvent.findMany({ where: { integrationId: integration.id } });
      expect(events.map((e) => e.type)).toEqual(["DISCONNECTED"]);
    });

    it("rejects disconnecting another user's integration", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const integration = await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "FOLLOW_UP_BOSS", status: "CONNECTED" },
      });

      const result = await disconnectIntegration(otherUser.id, integration.id, getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
      const row = await getTestDb().integration.findUnique({ where: { id: integration.id } });
      expect(row?.status).toBe("CONNECTED");
    });

    it("reports not-found for a nonexistent integration id", async () => {
      const owner = await createTestUser();
      const result = await disconnectIntegration(owner.id, "nonexistent-id", getTestDb());
      expect(result).toEqual({ outcome: "not-found" });
    });

    it("does not delete the CRM records an ExternalSyncLink points at, or the link itself", async () => {
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);
      const integration = await getTestDb().integration.create({
        data: { ownerId: owner.id, provider: "FOLLOW_UP_BOSS", status: "CONNECTED" },
      });
      await getTestDb().externalSyncLink.create({
        data: {
          integrationId: integration.id,
          provider: "FOLLOW_UP_BOSS",
          internalRecordType: "CONTACT",
          internalRecordId: contact.id,
          externalId: "fub-contact-123",
          ownerId: owner.id,
        },
      });

      await disconnectIntegration(owner.id, integration.id, getTestDb());

      const stillThereContact = await getTestDb().contact.findUnique({ where: { id: contact.id } });
      expect(stillThereContact).not.toBeNull();
      const stillThereLink = await getTestDb().externalSyncLink.findFirst({ where: { integrationId: integration.id } });
      expect(stillThereLink).not.toBeNull();
    });
  });

  describe("recordIntegrationEvent", () => {
    it("records an event with a message and metadata", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BULLSEYE" } });

      await recordIntegrationEvent(integration.id, "SYNC_COMPLETED", "Synced 12 contacts", { count: 12 }, getTestDb());

      const events = await getTestDb().integrationEvent.findMany({ where: { integrationId: integration.id } });
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe("Synced 12 contacts");
      expect(events[0].metadata).toEqual({ count: 12 });
    });
  });

  describe("createExternalSyncLink", () => {
    it("creates a mapping for an owned integration", async () => {
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });

      const result = await createExternalSyncLink(
        owner.id,
        { integrationId: integration.id, internalRecordType: "CONTACT", internalRecordId: contact.id, externalId: "bt-1" },
        getTestDb(),
      );

      expect(result.outcome).toBe("created");
      if (result.outcome !== "created") throw new Error("expected created");
      const row = await getTestDb().externalSyncLink.findUnique({ where: { id: result.syncLinkId } });
      expect(row?.provider).toBe("BOLDTRAIL");
      expect(row?.ownerId).toBe(owner.id);
      expect(row?.syncStatus).toBe("PENDING");
    });

    it("rejects mapping through an integration that does not belong to the user", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const contact = await createTestContact(owner.id);
      const integration = await getTestDb().integration.create({ data: { ownerId: otherUser.id, provider: "BOLDTRAIL" } });

      const result = await createExternalSyncLink(
        owner.id,
        { integrationId: integration.id, internalRecordType: "CONTACT", internalRecordId: contact.id, externalId: "bt-1" },
        getTestDb(),
      );

      expect(result).toEqual({ outcome: "integration-not-found" });
    });

    it("prevents a duplicate mapping for the same integration + internal record + external record", async () => {
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });
      const params = { integrationId: integration.id, internalRecordType: "CONTACT" as const, internalRecordId: contact.id, externalId: "bt-1" };

      const first = await createExternalSyncLink(owner.id, params, getTestDb());
      const second = await createExternalSyncLink(owner.id, params, getTestDb());

      expect(first.outcome).toBe("created");
      expect(second).toEqual({ outcome: "duplicate" });
      const count = await getTestDb().externalSyncLink.count({ where: { integrationId: integration.id } });
      expect(count).toBe(1);
    });

    it("allows the same external id to map to two different internal record types (no cross-type collision)", async () => {
      const owner = await createTestUser();
      const contact = await createTestContact(owner.id);
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });

      const contactLink = await createExternalSyncLink(
        owner.id,
        { integrationId: integration.id, internalRecordType: "CONTACT", internalRecordId: contact.id, externalId: "same-id" },
        getTestDb(),
      );
      const taskLink = await createExternalSyncLink(
        owner.id,
        { integrationId: integration.id, internalRecordType: "TASK", internalRecordId: "some-task-id", externalId: "same-id" },
        getTestDb(),
      );

      expect(contactLink.outcome).toBe("created");
      expect(taskLink.outcome).toBe("created");
    });
  });

  describe("markSyncLinkStatus", () => {
    async function createLink(ownerId: string, integrationId: string) {
      const link = await getTestDb().externalSyncLink.create({
        data: {
          integrationId,
          provider: "BOLDTRAIL",
          internalRecordType: "CONTACT",
          internalRecordId: "some-contact-id",
          externalId: "bt-1",
          ownerId,
        },
      });
      return link;
    }

    it("transitions PENDING -> SYNCING -> SYNCED, setting lastSyncedAt", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });
      const link = await createLink(owner.id, integration.id);
      const now = new Date("2026-09-15T12:00:00.000Z");

      await markSyncLinkStatus(owner.id, link.id, "SYNCING", undefined, getTestDb());
      const syncing = await getTestDb().externalSyncLink.findUnique({ where: { id: link.id } });
      expect(syncing?.syncStatus).toBe("SYNCING");

      await markSyncLinkStatus(owner.id, link.id, "SYNCED", undefined, getTestDb(), now);
      const synced = await getTestDb().externalSyncLink.findUnique({ where: { id: link.id } });
      expect(synced?.syncStatus).toBe("SYNCED");
      expect(synced?.lastSyncedAt?.toISOString()).toBe(now.toISOString());
      expect(synced?.syncError).toBeNull();
    });

    it("transitions to ERROR, recording syncError", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });
      const link = await createLink(owner.id, integration.id);

      await markSyncLinkStatus(owner.id, link.id, "ERROR", "rate limited", getTestDb());

      const row = await getTestDb().externalSyncLink.findUnique({ where: { id: link.id } });
      expect(row?.syncStatus).toBe("ERROR");
      expect(row?.syncError).toBe("rate limited");
    });

    it("rejects updating another user's sync link", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BOLDTRAIL" } });
      const link = await createLink(owner.id, integration.id);

      const result = await markSyncLinkStatus(otherUser.id, link.id, "SYNCED", undefined, getTestDb());

      expect(result).toEqual({ outcome: "not-found" });
    });
  });
});
