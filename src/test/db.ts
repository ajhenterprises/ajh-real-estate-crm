import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

/**
 * Minimal, reusable Postgres/Prisma integration-test harness (Phase 7).
 *
 * ONE-TIME LOCAL SETUP (run once per machine — never done automatically by
 * the test suite itself):
 *
 *   createdb -h localhost -U postgres ajh_real_estate_crm_test
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ajh_real_estate_crm_test?schema=public" \
 *     npx prisma migrate deploy
 *
 * Then set TEST_DATABASE_URL in .env to that same connection string (see
 * .env.example). Every *.integration.test.ts file imports `hasTestDatabase`
 * from this module and wraps its top-level `describe` in
 * `describe.skipIf(!hasTestDatabase)`, so `npm test` stays green (skipping,
 * not failing) anywhere TEST_DATABASE_URL isn't configured — a fresh clone,
 * CI without a Postgres test database — while running for real wherever it
 * is. This is the same file every future phase should import for DB-backed
 * tests rather than building a second harness.
 *
 * SAFETY: this module will not touch a database unless the connection
 * string is structurally impossible to confuse with the dev database — it
 * must differ from DATABASE_URL, and its database name must contain "test".
 * `resetTestDatabase()` only ever runs SQL through this module's own
 * test-scoped Prisma client, never through src/lib/db.ts's dev client, so a
 * reset cannot reach the dev database even if the safety check above were
 * somehow bypassed.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const devDatabaseUrl = process.env.DATABASE_URL;

function isSafeTestDatabaseUrl(url: string | undefined): url is string {
  if (!url) return false;
  if (url === devDatabaseUrl) return false;
  const databaseName = url.split("?")[0].split("/").pop() ?? "";
  return databaseName.includes("test");
}

/** True when TEST_DATABASE_URL is set and safely distinct from DATABASE_URL. Check this before calling anything else here. */
export const hasTestDatabase = isSafeTestDatabaseUrl(testDatabaseUrl);

let testClient: PrismaClient | undefined;

/** The dedicated test-database Prisma client. Throws if `hasTestDatabase` is false — always check that first. */
export function getTestDb(): PrismaClient {
  if (!hasTestDatabase) {
    throw new Error(
      'TEST_DATABASE_URL is not set to a safe, dedicated test database (it must differ from DATABASE_URL and its database name must contain "test"). ' +
        "Integration test files should check `hasTestDatabase` and skip via `describe.skipIf(!hasTestDatabase)` rather than call this.",
    );
  }
  if (!testClient) {
    testClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl }) });
  }
  return testClient;
}

/** Closes the test client's connection pool. Call once in a top-level `afterAll`. */
export async function closeTestDb(): Promise<void> {
  await testClient?.$disconnect();
  testClient = undefined;
}

// Every application table (see prisma/schema.prisma's @@map values).
// CASCADE resolves foreign-key ordering, so listing order doesn't matter.
// _prisma_migrations is deliberately excluded — truncating it would make
// Prisma think no migrations have been applied.
const APP_TABLES = [
  "users",
  "contacts",
  "contact_activities",
  "clients",
  "transactions",
  "transaction_events",
  "tasks",
  "task_templates",
  "documents",
  "contract_information",
  "integrations",
  "external_sync_links",
] as const;

/**
 * Empties every application table in the test database. Call in a
 * `beforeEach`/`afterEach` so each test starts from a known-empty state.
 * Safe by construction: only ever executes against `getTestDb()`'s
 * connection, which only exists once `hasTestDatabase` has been verified.
 */
export async function resetTestDatabase(): Promise<void> {
  const db = getTestDb();
  const tableList = APP_TABLES.map((table) => `"${table}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
}

/** Creates a User row directly in the test database for use as a test fixture's owner. */
export async function createTestUser(
  overrides: Partial<{ email: string; name: string; password: string }> = {},
) {
  const db = getTestDb();
  const email = overrides.email ?? `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  // Low cost factor: this only ever hashes throwaway test passwords in a
  // database that gets truncated between tests — speed matters more here
  // than the production cost factor used by src/lib/auth/config.ts.
  const passwordHash = await bcrypt.hash(overrides.password ?? "test-password", 4);
  return db.user.create({
    data: { email, name: overrides.name ?? "Test Agent", passwordHash },
  });
}

/** Creates a Contact row owned by `ownerId` directly in the test database. */
export async function createTestContact(
  ownerId: string,
  overrides: Partial<{ firstName: string; lastName: string; nextFollowUpDate: Date | null }> = {},
) {
  const db = getTestDb();
  return db.contact.create({
    data: {
      firstName: overrides.firstName ?? "Test",
      lastName: overrides.lastName ?? "Contact",
      ownerId,
      nextFollowUpDate: overrides.nextFollowUpDate,
    },
  });
}
