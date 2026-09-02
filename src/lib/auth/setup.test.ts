import { describe, expect, it } from "vitest";
import { setupSchema } from "@/lib/auth/setup";

const validInput = {
  token: "a-setup-token",
  name: "Aaron",
  email: "aaron@example.com",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
};

describe("setupSchema", () => {
  it("accepts valid input", () => {
    expect(setupSchema.safeParse(validInput).success).toBe(true);
  });

  it("defaults name to Admin when blank", () => {
    const parsed = setupSchema.safeParse({ ...validInput, name: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Admin");
  });

  it("lowercases and trims email", () => {
    const parsed = setupSchema.safeParse({ ...validInput, email: "  Aaron@Example.com  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("aaron@example.com");
  });

  it("rejects a missing setup token", () => {
    expect(setupSchema.safeParse({ ...validInput, token: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(setupSchema.safeParse({ ...validInput, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a password shorter than 12 characters", () => {
    expect(
      setupSchema.safeParse({ ...validInput, password: "short1234", confirmPassword: "short1234" })
        .success,
    ).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const parsed = setupSchema.safeParse({ ...validInput, confirmPassword: "different-password" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });
});
