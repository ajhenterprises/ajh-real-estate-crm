import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { S3StorageAdapter, s3ConfigFromEnv, type S3ClientLike } from "@/lib/storage/s3";

const testConfig = {
  bucket: "test-bucket",
  region: "auto",
  endpoint: "https://example.r2.cloudflarestorage.com",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
};

function fakeClient(send: S3ClientLike["send"]): S3ClientLike {
  return { send };
}

describe("s3ConfigFromEnv", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("reads every variable when all are set", () => {
    process.env.S3_BUCKET = "my-bucket";
    process.env.S3_REGION = "us-east-1";
    process.env.S3_ENDPOINT = "https://s3.us-east-1.amazonaws.com";
    process.env.S3_ACCESS_KEY_ID = "key-id";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    process.env.S3_FORCE_PATH_STYLE = "true";

    expect(s3ConfigFromEnv()).toEqual({
      bucket: "my-bucket",
      region: "us-east-1",
      endpoint: "https://s3.us-east-1.amazonaws.com",
      accessKeyId: "key-id",
      secretAccessKey: "secret",
      forcePathStyle: true,
    });
  });

  it("defaults region to 'auto', leaves endpoint unset, and forcePathStyle false when not provided", () => {
    process.env.S3_BUCKET = "my-bucket";
    process.env.S3_ACCESS_KEY_ID = "key-id";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    delete process.env.S3_REGION;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_FORCE_PATH_STYLE;

    expect(s3ConfigFromEnv()).toEqual({
      bucket: "my-bucket",
      region: "auto",
      endpoint: undefined,
      accessKeyId: "key-id",
      secretAccessKey: "secret",
      forcePathStyle: false,
    });
  });

  it("throws a clear error naming the missing variable", () => {
    delete process.env.S3_BUCKET;
    process.env.S3_ACCESS_KEY_ID = "key-id";
    process.env.S3_SECRET_ACCESS_KEY = "secret";

    expect(() => s3ConfigFromEnv()).toThrow(/S3_BUCKET/);
  });
});

describe("S3StorageAdapter", () => {
  describe("put", () => {
    it("sends a PutObjectCommand with the bucket, key, body, and content type, and returns the key", async () => {
      const send = vi.fn().mockResolvedValue({});
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      const result = await adapter.put({
        key: "transactions/tx1/doc.pdf",
        body: Buffer.from("pdf bytes"),
        contentType: "application/pdf",
      });

      expect(result).toBe("transactions/tx1/doc.pdf");
      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "transactions/tx1/doc.pdf",
        Body: Buffer.from("pdf bytes"),
        ContentType: "application/pdf",
      });
    });
  });

  describe("get", () => {
    it("returns the object's bytes as a Buffer", async () => {
      const bytes = new Uint8Array(Buffer.from("hello world"));
      const send = vi.fn().mockResolvedValue({
        Body: { transformToByteArray: async () => bytes },
      });
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      const result = await adapter.get("transactions/tx1/doc.pdf");

      expect(result).toEqual(Buffer.from("hello world"));
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: "test-bucket", Key: "transactions/tx1/doc.pdf" });
    });

    it("throws an ENOENT-coded error when the SDK reports NoSuchKey", async () => {
      const notFound = Object.assign(new Error("The specified key does not exist."), { name: "NoSuchKey" });
      const send = vi.fn().mockRejectedValue(notFound);
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      const error = await adapter.get("missing.pdf").catch((e: unknown) => e);
      expect(error).toMatchObject({ code: "ENOENT" });
      expect((error as Error).cause).toBe(notFound);
    });

    it("throws an ENOENT-coded error when the SDK reports a plain 404 without a NoSuchKey name", async () => {
      const notFound = Object.assign(new Error("Not Found"), { $metadata: { httpStatusCode: 404 } });
      const send = vi.fn().mockRejectedValue(notFound);
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      const error = await adapter.get("missing.pdf").catch((e: unknown) => e);
      expect(error).toMatchObject({ code: "ENOENT" });
    });

    it("rethrows a non-not-found error unchanged, without an ENOENT code", async () => {
      const accessDenied = Object.assign(new Error("Access Denied"), {
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
      });
      const send = vi.fn().mockRejectedValue(accessDenied);
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      const error = await adapter.get("forbidden.pdf").catch((e: unknown) => e);
      expect(error).toBe(accessDenied);
      expect((error as { code?: unknown }).code).not.toBe("ENOENT");
    });
  });

  describe("delete", () => {
    it("sends a DeleteObjectCommand with the bucket and key", async () => {
      const send = vi.fn().mockResolvedValue({});
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      await adapter.delete("transactions/tx1/doc.pdf");

      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Bucket: "test-bucket", Key: "transactions/tx1/doc.pdf" });
    });

    it("does not throw when the SDK reports success for an already-absent key (S3's native idempotent-delete behavior)", async () => {
      // Real S3/R2 DeleteObject returns 204 for a key that never existed —
      // there is nothing to simulate beyond a normal resolved send(); this
      // documents that deleteDocument's "missing is fine" expectation
      // (src/lib/documents/mutations.ts) holds for this adapter without any
      // special-casing, unlike LocalFilesystemStorageAdapter's ENOENT path.
      const send = vi.fn().mockResolvedValue({});
      const adapter = new S3StorageAdapter(testConfig, fakeClient(send));

      await expect(adapter.delete("never-existed.pdf")).resolves.toBeUndefined();
    });
  });
});
