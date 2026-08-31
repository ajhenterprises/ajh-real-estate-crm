import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageAdapter } from "@/lib/storage";

const DEFAULT_ROOT = path.join(process.cwd(), ".data", "documents");

/**
 * Stores documents on local disk, outside of `public/`, so files are never
 * reachable by a direct URL. Suitable for a single-instance deployment;
 * swap for an S3-compatible adapter before scaling beyond one machine.
 */
export class LocalFilesystemStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(root: string = process.env.DOCUMENT_STORAGE_PATH || DEFAULT_ROOT) {
    this.root = root;
  }

  private resolve(key: string): string {
    const normalized = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
    return path.join(this.root, normalized);
  }

  async put({ key, body }: { key: string; body: Buffer; contentType: string }): Promise<string> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key));
  }
}
