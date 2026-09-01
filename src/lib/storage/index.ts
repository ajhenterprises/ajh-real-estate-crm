import { LocalFilesystemStorageAdapter } from "@/lib/storage/local";
import { S3StorageAdapter } from "@/lib/storage/s3";

/**
 * Document storage abstraction.
 *
 * Nothing in the application should read/write files directly — everything
 * goes through this interface so the backing store (local disk in
 * development/test, an S3-compatible bucket in production) can change
 * without touching feature code. Documents in the database only ever hold
 * the opaque `storagePath` (key) this interface hands back from `put()`.
 *
 * Error contract every adapter must honor: `get()` must throw an error
 * whose `.code === "ENOENT"` when the key doesn't exist — callers (the
 * document download route, the delete-ordering logic in
 * src/lib/documents/mutations.ts) branch on exactly that shape to tell
 * "missing" apart from a real failure. `delete()` of an already-missing key
 * should not throw at all (both adapters already satisfy this: node:fs's
 * unlink is the one exception callers explicitly tolerate via the same
 * ENOENT check; S3's DeleteObject is natively idempotent).
 */
export interface StorageAdapter {
  /** Persist a file and return the opaque key to store as Document.storagePath. */
  put(params: { key: string; body: Buffer; contentType: string }): Promise<string>;
  /** Fetch a previously stored file's bytes. Throws an error with `.code === "ENOENT"` if the key doesn't exist. */
  get(key: string): Promise<Buffer>;
  /** Permanently remove a stored file. A no-op (not an error) if the key is already absent. */
  delete(key: string): Promise<void>;
}

export { LocalFilesystemStorageAdapter, S3StorageAdapter };

let adapter: StorageAdapter | undefined;

/**
 * Selects the adapter via DOCUMENT_STORAGE_DRIVER ("local", the default, or
 * "s3") so switching backends — including switching S3-compatible
 * providers — is an environment-variable change, never a code change. See
 * .env.example for the full list of driver-specific variables.
 */
export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    adapter = createStorageAdapter();
  }
  return adapter;
}

/** Exported for the driver-selection unit test (src/lib/storage/index.test.ts); not for use as an adapter cache like getStorageAdapter(). */
export function createStorageAdapter(): StorageAdapter {
  const driver = process.env.DOCUMENT_STORAGE_DRIVER || "local";
  switch (driver) {
    case "local":
      return new LocalFilesystemStorageAdapter();
    case "s3":
      return new S3StorageAdapter();
    default:
      throw new Error(`Unknown DOCUMENT_STORAGE_DRIVER "${driver}". Expected "local" or "s3".`);
  }
}
