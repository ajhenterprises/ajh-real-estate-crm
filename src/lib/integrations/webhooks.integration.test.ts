import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { markWebhookEventStatus, recordWebhookEvent } from "@/lib/integrations/webhooks";

describe.skipIf(!hasTestDatabase)("webhook foundation (integration)", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  describe("recordWebhookEvent", () => {
    it("records a new delivery", async () => {
      const result = await recordWebhookEvent(
        { provider: "FOLLOW_UP_BOSS", externalEventId: "evt-1", eventType: "contact.updated", payload: { id: "123" } },
        getTestDb(),
      );

      expect(result.outcome).toBe("recorded");
      if (result.outcome !== "recorded") throw new Error("expected recorded");
      const row = await getTestDb().webhookEvent.findUnique({ where: { id: result.webhookEventId } });
      expect(row?.processingStatus).toBe("RECEIVED");
      expect(row?.eventType).toBe("contact.updated");
    });

    it("is idempotent: the same (provider, externalEventId) delivered twice is recorded only once", async () => {
      const first = await recordWebhookEvent(
        { provider: "FOLLOW_UP_BOSS", externalEventId: "evt-dup", eventType: "contact.updated" },
        getTestDb(),
      );
      const second = await recordWebhookEvent(
        { provider: "FOLLOW_UP_BOSS", externalEventId: "evt-dup", eventType: "contact.updated" },
        getTestDb(),
      );

      expect(first.outcome).toBe("recorded");
      expect(second).toEqual({ outcome: "duplicate", webhookEventId: (first as { webhookEventId: string }).webhookEventId });
      const count = await getTestDb().webhookEvent.count({ where: { provider: "FOLLOW_UP_BOSS", externalEventId: "evt-dup" } });
      expect(count).toBe(1);
    });

    it("does not treat the same externalEventId from two different providers as a duplicate", async () => {
      const fromFub = await recordWebhookEvent(
        { provider: "FOLLOW_UP_BOSS", externalEventId: "shared-id", eventType: "contact.updated" },
        getTestDb(),
      );
      const fromBullseye = await recordWebhookEvent(
        { provider: "BULLSEYE", externalEventId: "shared-id", eventType: "contact.updated" },
        getTestDb(),
      );

      expect(fromFub.outcome).toBe("recorded");
      expect(fromBullseye.outcome).toBe("recorded");
    });

    it("associates a webhook event with an integration when one is given, and leaves it unmatched when not", async () => {
      const owner = await createTestUser();
      const integration = await getTestDb().integration.create({ data: { ownerId: owner.id, provider: "BULLSEYE" } });

      const matched = await recordWebhookEvent(
        { provider: "BULLSEYE", integrationId: integration.id, externalEventId: "evt-matched", eventType: "deal.created" },
        getTestDb(),
      );
      const unmatched = await recordWebhookEvent(
        { provider: "BULLSEYE", externalEventId: "evt-unmatched", eventType: "deal.created" },
        getTestDb(),
      );

      if (matched.outcome !== "recorded" || unmatched.outcome !== "recorded") throw new Error("setup failed");
      const matchedRow = await getTestDb().webhookEvent.findUnique({ where: { id: matched.webhookEventId } });
      const unmatchedRow = await getTestDb().webhookEvent.findUnique({ where: { id: unmatched.webhookEventId } });
      expect(matchedRow?.integrationId).toBe(integration.id);
      expect(unmatchedRow?.integrationId).toBeNull();
    });
  });

  describe("markWebhookEventStatus", () => {
    it("transitions RECEIVED -> PROCESSING -> PROCESSED, setting processedAt", async () => {
      const recorded = await recordWebhookEvent(
        { provider: "BOLDTRAIL", externalEventId: "evt-lifecycle", eventType: "task.created" },
        getTestDb(),
      );
      if (recorded.outcome !== "recorded") throw new Error("setup failed");
      const now = new Date("2026-09-15T12:00:00.000Z");

      await markWebhookEventStatus(recorded.webhookEventId, "PROCESSING", undefined, getTestDb());
      const processing = await getTestDb().webhookEvent.findUnique({ where: { id: recorded.webhookEventId } });
      expect(processing?.processingStatus).toBe("PROCESSING");

      await markWebhookEventStatus(recorded.webhookEventId, "PROCESSED", undefined, getTestDb(), now);
      const processed = await getTestDb().webhookEvent.findUnique({ where: { id: recorded.webhookEventId } });
      expect(processed?.processingStatus).toBe("PROCESSED");
      expect(processed?.processedAt?.toISOString()).toBe(now.toISOString());
    });

    it("transitions to FAILED, recording the error and incrementing retryCount", async () => {
      const recorded = await recordWebhookEvent(
        { provider: "BOLDTRAIL", externalEventId: "evt-fail", eventType: "task.created" },
        getTestDb(),
      );
      if (recorded.outcome !== "recorded") throw new Error("setup failed");

      await markWebhookEventStatus(recorded.webhookEventId, "FAILED", "downstream 500", getTestDb());
      const firstFailure = await getTestDb().webhookEvent.findUnique({ where: { id: recorded.webhookEventId } });
      expect(firstFailure?.processingStatus).toBe("FAILED");
      expect(firstFailure?.errorMessage).toBe("downstream 500");
      expect(firstFailure?.retryCount).toBe(1);

      await markWebhookEventStatus(recorded.webhookEventId, "FAILED", "downstream 500 again", getTestDb());
      const secondFailure = await getTestDb().webhookEvent.findUnique({ where: { id: recorded.webhookEventId } });
      expect(secondFailure?.retryCount).toBe(2);
    });

    it("reports not-found for a nonexistent webhook event id", async () => {
      const result = await markWebhookEventStatus("nonexistent-id", "PROCESSED", undefined, getTestDb());
      expect(result).toEqual({ outcome: "not-found" });
    });
  });
});
