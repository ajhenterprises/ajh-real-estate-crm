import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import type { StorageAdapter } from "@/lib/storage";

/**
 * Production document storage for any S3-compatible provider (Cloudflare
 * R2, AWS S3, Backblaze B2, MinIO, ...). Nothing here is Cloudflare- or
 * AWS-specific: `endpoint` is only set when the environment provides one
 * (R2/MinIO/etc — real AWS S3 omits it and the SDK derives the endpoint
 * from `region`), so switching providers is an environment-variable change,
 * not a code change.
 *
 * Error-shape contract with LocalFilesystemStorageAdapter (see
 * src/lib/storage/local.ts and the StorageAdapter interface doc in
 * src/lib/storage/index.ts): callers across this codebase — the delete-
 * ordering logic in src/lib/documents/mutations.ts, and the 404 handling
 * in src/app/api/documents/[id]/route.ts — check a thrown error's `.code`
 * for `"ENOENT"` to mean "this key doesn't exist." node:fs already throws
 * that shape natively; the AWS SDK does not (S3 signals a missing object
 * with a `NoSuchKey` error name / 404 status), so `get()` below normalizes
 * that one case to the same `.code === "ENOENT"` shape. `delete()` needs no
 * such translation: S3's DeleteObject is idempotent by design (deleting an
 * absent key still succeeds), which already matches the "missing is fine"
 * behavior deleteDocument relies on — it just never throws in that case.
 */

export interface S3StorageAdapterConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example for the production object-storage variables.`);
  }
  return value;
}

/** Reads S3StorageAdapterConfig from environment variables. See .env.example for the full list and what each controls. */
export function s3ConfigFromEnv(): S3StorageAdapterConfig {
  return {
    bucket: requireEnv("S3_BUCKET"),
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: requireEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? (error as { name?: unknown }).name : undefined;
  const statusCode =
    "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata?.httpStatusCode
      : undefined;
  return name === "NoSuchKey" || statusCode === 404;
}

/** The slice of S3Client's surface this adapter actually calls — narrowed so tests can pass a fake without constructing a real S3Client. */
export interface S3ClientLike {
  send: S3Client["send"];
}

export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3ClientLike;
  private readonly bucket: string;

  constructor(config: S3StorageAdapterConfig = s3ConfigFromEnv(), client?: S3ClientLike) {
    this.bucket = config.bucket;
    if (client) {
      this.client = client;
    } else {
      const clientConfig: S3ClientConfig = {
        region: config.region ?? "auto",
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      };
      this.client = new S3Client(clientConfig);
    }
  }

  async put({ key, body, contentType }: { key: string; body: Buffer; contentType: string }): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return key;
  }

  async get(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      return Buffer.from(bytes ?? new Uint8Array());
    } catch (error) {
      if (isNotFoundError(error)) {
        throw Object.assign(new Error(`No such key: ${key}`), { code: "ENOENT", cause: error });
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
