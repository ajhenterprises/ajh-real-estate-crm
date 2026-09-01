import { afterEach, describe, expect, it } from "vitest";
import { createStorageAdapter, LocalFilesystemStorageAdapter, S3StorageAdapter } from "@/lib/storage";

describe("createStorageAdapter (DOCUMENT_STORAGE_DRIVER selection)", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("defaults to LocalFilesystemStorageAdapter when DOCUMENT_STORAGE_DRIVER is unset", () => {
    delete process.env.DOCUMENT_STORAGE_DRIVER;
    expect(createStorageAdapter()).toBeInstanceOf(LocalFilesystemStorageAdapter);
  });

  it('selects LocalFilesystemStorageAdapter for "local"', () => {
    process.env.DOCUMENT_STORAGE_DRIVER = "local";
    expect(createStorageAdapter()).toBeInstanceOf(LocalFilesystemStorageAdapter);
  });

  it('selects S3StorageAdapter for "s3", reading its config from the S3_* env vars', () => {
    process.env.DOCUMENT_STORAGE_DRIVER = "s3";
    process.env.S3_BUCKET = "prod-bucket";
    process.env.S3_ACCESS_KEY_ID = "key-id";
    process.env.S3_SECRET_ACCESS_KEY = "secret";
    expect(createStorageAdapter()).toBeInstanceOf(S3StorageAdapter);
  });

  it("throws a clear error for an unrecognized driver", () => {
    process.env.DOCUMENT_STORAGE_DRIVER = "azure-blob";
    expect(() => createStorageAdapter()).toThrow(/Unknown DOCUMENT_STORAGE_DRIVER "azure-blob"/);
  });
});
