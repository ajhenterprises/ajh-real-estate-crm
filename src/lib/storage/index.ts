import { LocalFilesystemStorageAdapter } from "@/lib/storage/local";

/**
 * Document storage abstraction.
 *
 * Nothing in the application should read/write files directly — everything
 * goes through this interface so the backing store (local disk today, an
 * S3-compatible bucket later) can change without touching feature code.
 * Documents in the database only ever hold the opaque `storagePath` (key)
 * this interface hands back from `put()`.
 */
export interface StorageAdapter {
  /** Persist a file and return the opaque key to store as Document.storagePath. */
  put(params: { key: string; body: Buffer; contentType: string }): Promise<string>;
  /** Fetch a previously stored file's bytes. */
  get(key: string): Promise<Buffer>;
  /** Permanently remove a stored file. */
  delete(key: string): Promise<void>;
}

export { LocalFilesystemStorageAdapter };

let adapter: StorageAdapter | undefined;

// Only a local filesystem adapter exists today. Adding an S3-compatible
// backend later means adding an adapter class and switching this factory —
// no callers change.
export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    adapter = new LocalFilesystemStorageAdapter();
  }
  return adapter;
}
