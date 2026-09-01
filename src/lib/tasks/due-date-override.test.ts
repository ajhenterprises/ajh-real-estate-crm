import { describe, expect, it } from "vitest";
import { shouldMarkTaskDueDateOverridden } from "@/lib/tasks/due-date-override";

describe("shouldMarkTaskDueDateOverridden", () => {
  it("stays false when the due date is not part of this edit", () => {
    const existing = { dueDate: new Date("2026-09-15"), isOverridden: false };
    expect(shouldMarkTaskDueDateOverridden(existing, undefined)).toBe(false);
  });

  it("stays false when the due date is resubmitted unchanged", () => {
    const existing = { dueDate: new Date("2026-09-15"), isOverridden: false };
    expect(shouldMarkTaskDueDateOverridden(existing, new Date("2026-09-15"))).toBe(false);
  });

  it("becomes true when the due date is manually changed", () => {
    const existing = { dueDate: new Date("2026-09-15"), isOverridden: false };
    expect(shouldMarkTaskDueDateOverridden(existing, new Date("2026-09-20"))).toBe(true);
  });

  it("becomes true when a due date is set for the first time", () => {
    const existing = { dueDate: null, isOverridden: false };
    expect(shouldMarkTaskDueDateOverridden(existing, new Date("2026-09-20"))).toBe(true);
  });

  it("stays overridden once set, even on an edit that doesn't touch the due date", () => {
    const existing = { dueDate: new Date("2026-09-20"), isOverridden: true };
    expect(shouldMarkTaskDueDateOverridden(existing, undefined)).toBe(true);
  });

  it("never clears the override itself — only the dedicated reset action does that", () => {
    const existing = { dueDate: new Date("2026-09-20"), isOverridden: true };
    expect(shouldMarkTaskDueDateOverridden(existing, new Date("2026-09-20"))).toBe(true);
  });
});
