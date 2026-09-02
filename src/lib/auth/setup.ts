// Deliberately no `import "server-only"` here — same reasoning as
// src/lib/repos/contacts.ts: this lets setupSchema be exercised directly by
// a unit test (src/lib/auth/setup.test.ts). Only ever imported from
// src/app/setup/page.tsx (a Server Component) and
// src/lib/auth/setup-actions.ts ("use server"), both inherently server-only,
// so the guard would be redundant defense-in-depth, not a functional need.
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

/**
 * One-time, browser-accessible first-admin bootstrap for production
 * deployments where the only other way to create a login is
 * `prisma/seed.ts`'s SEED_USER_* vars, which need terminal/CLI access to
 * run. Guarded on three independent conditions, all required:
 *  - ADMIN_SETUP_SECRET is set (and reasonably long) — unset means disabled.
 *  - the caller's submitted token matches it, compared in constant time.
 *  - there are zero rows in `users` — this is a first-admin bootstrap only,
 *    never a general "create user" endpoint, and refuses permanently once
 *    that first row exists.
 * The insert runs behind a Postgres advisory lock inside the transaction so
 * two setup requests landing at once can't both pass the zero-user check
 * before either has inserted.
 */

const MIN_SECRET_LENGTH = 16;
// Arbitrary fixed key for the advisory lock — only needs to be constant and
// unique to this feature, not secret or derived from anything.
const SETUP_ADVISORY_LOCK_KEY = 872634501;

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const setupSchema = z
  .object({
    token: z.string().min(1, "Setup token is required"),
    name: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(200).optional()).default("Admin"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export class SetupUnavailableError extends Error {}
export class SetupTokenInvalidError extends Error {}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function getSetupSecret(): string | undefined {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return undefined;
  return secret;
}

/**
 * Whether the setup page should render its form at all. Only ever reveals a
 * boolean — never a user count, an email, or any other user data — so it's
 * safe to call from a page that renders before authentication exists.
 */
export async function isSetupAvailable(): Promise<boolean> {
  if (!getSetupSecret()) return false;
  const userCount = await prisma.user.count();
  return userCount === 0;
}

export async function createFirstAdmin(input: {
  token: string;
  name: string;
  email: string;
  password: string;
}) {
  const secret = getSetupSecret();
  if (!secret) {
    throw new SetupUnavailableError("First-admin setup is not enabled.");
  }
  if (!safeCompare(input.token, secret)) {
    throw new SetupTokenInvalidError("Invalid setup token.");
  }

  // Hash before opening the transaction so the (deliberately slow) bcrypt
  // work doesn't hold the advisory lock, or a DB connection, open.
  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SETUP_ADVISORY_LOCK_KEY})`;

    const userCount = await tx.user.count();
    if (userCount > 0) {
      throw new SetupUnavailableError("Setup has already been completed.");
    }

    return tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: "ADMIN",
      },
    });
  });
}
