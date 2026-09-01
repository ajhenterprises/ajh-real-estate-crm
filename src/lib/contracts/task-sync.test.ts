import { describe, expect, it } from "vitest";
import {
  CONTRACT_TASK_EVENT_TYPES,
  decideContractTaskReconciliation,
  isContractTaskEventType,
} from "@/lib/contracts/task-sync";

describe("isContractTaskEventType", () => {
  it("accepts only the four period-derived deadlines", () => {
    expect(CONTRACT_TASK_EVENT_TYPES).toEqual([
      "INSPECTION_PERIOD_END",
      "FINANCING_DEADLINE",
      "APPRAISAL_DEADLINE",
      "TITLE_DEADLINE",
    ]);
    for (const eventType of CONTRACT_TASK_EVENT_TYPES) {
      expect(isContractTaskEventType(eventType)).toBe(true);
    }
  });

  it("rejects directly-entered milestones already covered by the checklist", () => {
    expect(isContractTaskEventType("CONTRACT_EFFECTIVE")).toBe(false);
    expect(isContractTaskEventType("EARNEST_MONEY_DUE")).toBe(false);
    expect(isContractTaskEventType("INSPECTION_PERIOD_START")).toBe(false);
    expect(isContractTaskEventType("CLOSING_DATE")).toBe(false);
    expect(isContractTaskEventType("FINAL_WALKTHROUGH")).toBe(false);
    expect(isContractTaskEventType("POSSESSION_DATE")).toBe(false);
    expect(isContractTaskEventType("OTHER")).toBe(false);
  });
});

describe("decideContractTaskReconciliation", () => {
  it("creates a task when none exists yet for the event", () => {
    expect(decideContractTaskReconciliation(null)).toEqual({ kind: "create" });
  });

  it("syncs the due date when the existing task is pending and not overridden", () => {
    expect(decideContractTaskReconciliation({ status: "PENDING", isOverridden: false })).toEqual({
      kind: "sync",
    });
  });

  it("skips a task the user has manually overridden, even while pending", () => {
    expect(decideContractTaskReconciliation({ status: "PENDING", isOverridden: true })).toEqual({
      kind: "skip",
    });
  });

  it("skips a completed task regardless of override state", () => {
    expect(decideContractTaskReconciliation({ status: "COMPLETED", isOverridden: false })).toEqual({
      kind: "skip",
    });
    expect(decideContractTaskReconciliation({ status: "COMPLETED", isOverridden: true })).toEqual({
      kind: "skip",
    });
  });

  it("skips a cancelled task regardless of override state", () => {
    expect(decideContractTaskReconciliation({ status: "CANCELLED", isOverridden: false })).toEqual({
      kind: "skip",
    });
    expect(decideContractTaskReconciliation({ status: "CANCELLED", isOverridden: true })).toEqual({
      kind: "skip",
    });
  });
});
