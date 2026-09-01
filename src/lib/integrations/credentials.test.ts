import { afterEach, describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "@/lib/integrations/credentials";
import { randomBytes } from "node:crypto";

const TEST_KEY = randomBytes(32).toString("base64");

describe("credentials (encryption)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("round-trips a plaintext credential through encrypt then decrypt", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = TEST_KEY;
    const plaintext = "sk_live_super_secret_api_key_12345";

    const encrypted = encryptCredential(plaintext);
    const decrypted = decryptCredential(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  it("never stores the plaintext verbatim inside the ciphertext", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = TEST_KEY;
    const plaintext = "a-very-recognizable-secret-token";

    const encrypted = encryptCredential(plaintext);

    expect(encrypted).not.toContain(plaintext);
  });

  it("produces different ciphertext for the same plaintext each time (random IV)", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = TEST_KEY;

    const first = encryptCredential("same-secret");
    const second = encryptCredential("same-secret");

    expect(first).not.toBe(second);
    expect(decryptCredential(first)).toBe("same-secret");
    expect(decryptCredential(second)).toBe("same-secret");
  });

  it("fails to decrypt a tampered ciphertext rather than returning wrong plaintext", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = TEST_KEY;
    const encrypted = encryptCredential("original-secret");
    const [iv, authTag, data] = encrypted.split(".");
    // Flip the last character of the data segment to corrupt it.
    const tamperedChar = data.at(-1) === "A" ? "B" : "A";
    const tampered = [iv, authTag, data.slice(0, -1) + tamperedChar].join(".");

    expect(() => decryptCredential(tampered)).toThrow();
  });

  it("fails to decrypt with the wrong key", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = TEST_KEY;
    const encrypted = encryptCredential("original-secret");

    process.env.INTEGRATION_CREDENTIALS_KEY = randomBytes(32).toString("base64");

    expect(() => decryptCredential(encrypted)).toThrow();
  });

  it("throws a clear error when INTEGRATION_CREDENTIALS_KEY is not set", () => {
    delete process.env.INTEGRATION_CREDENTIALS_KEY;
    expect(() => encryptCredential("secret")).toThrow(/INTEGRATION_CREDENTIALS_KEY is not set/);
  });

  it("throws a clear error when the key is not exactly 32 bytes", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = Buffer.from("too-short").toString("base64");
    expect(() => encryptCredential("secret")).toThrow(/32 bytes/);
  });

  it("throws on a malformed ciphertext (wrong number of segments)", () => {
    process.env.INTEGRATION_CREDENTIALS_KEY = TEST_KEY;
    expect(() => decryptCredential("not-a-valid-ciphertext")).toThrow(/Malformed/);
  });
});
