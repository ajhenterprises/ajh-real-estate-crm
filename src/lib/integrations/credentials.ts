import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts/decrypts integration credentials (API keys, OAuth access/
 * refresh tokens) for storage in Integration.encryptedCredentials.
 *
 * No encryption/security utility existed anywhere in this codebase before
 * this (bcryptjs, used for User.passwordHash, is a one-way hash — useless
 * here, since a stored credential must be recoverable to actually call a
 * provider's API later). This is the smallest correct abstraction: AES-256-
 * GCM (authenticated — a tampered or corrupted ciphertext fails to decrypt
 * rather than silently returning garbage) via Node's built-in `node:crypto`,
 * no new dependency.
 *
 * Key management: INTEGRATION_CREDENTIALS_KEY must be a base64-encoded
 * 32-byte key (`openssl rand -base64 32` — the exact same convention
 * already used for AUTH_SECRET). Never derived from a low-entropy secret
 * via a password-KDF (scrypt/argon2) — those exist to strengthen weak
 * passwords, which is the wrong tool when the input can just be a real
 * random key from the start.
 *
 * Contract callers must uphold: NEVER call encryptCredential/store its
 * result anywhere a client component or an unauthenticated response could
 * read it. NEVER log a plaintext credential, a decrypted value, or this
 * module's output. Integration.encryptedCredentials must never be
 * selected by any query whose result reaches a Server/Client Component
 * prop or a JSON API response — see src/lib/repos/integrations.ts, which
 * deliberately omits it from every select.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_CREDENTIALS_KEY;
  if (!secret) {
    throw new Error(
      "INTEGRATION_CREDENTIALS_KEY is not set. See .env.example. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_CREDENTIALS_KEY must decode to exactly 32 bytes (AES-256). Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/** Encrypts a plaintext credential. Returns an opaque string safe to store in Integration.encryptedCredentials — never log or return this to a client. */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

/** Decrypts a value produced by encryptCredential. Throws if the key is wrong or the ciphertext was tampered with/corrupted (GCM's authentication tag check) — never returns a silently-wrong plaintext. */
export function decryptCredential(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted credential (expected iv.authTag.ciphertext)");
  }
  const [ivB64, authTagB64, dataB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
