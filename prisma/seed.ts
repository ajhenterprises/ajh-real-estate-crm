import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { BUYER_CHECKLIST_TEMPLATES, SELLER_CHECKLIST_TEMPLATES } from "../src/lib/tasks/default-templates";
import type { DefaultTaskTemplate } from "../src/lib/tasks/default-templates";
import type { TransactionType } from "../src/generated/prisma/enums";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Development-only: creates the first login. Gated behind env vars so
 * running `db:seed` against a production database without them is a no-op
 * for this step — it never creates or overwrites real user accounts.
 */
async function seedDevUser() {
  const email = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;
  const name = process.env.SEED_USER_NAME ?? "Agent";

  if (!email || !password) {
    console.log(
      "Skipping user seed: set SEED_USER_EMAIL and SEED_USER_PASSWORD to create the first login.",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash, role: "ADMIN" },
  });

  console.log(`Seeded dev user ${user.email}`);
}

/**
 * Production reference/configuration data — NOT development test data.
 * The default buyer/seller checklists are part of the application's
 * configuration (like the design tokens), not per-environment sample
 * content, so this always runs, in every environment. Upserting by the
 * template's stable `key` makes it safe to re-run any number of times:
 * re-running never creates duplicate templates or touches already-generated
 * tasks.
 */
async function seedDefaultTaskTemplates() {
  const rows: (DefaultTaskTemplate & { transactionType: TransactionType })[] = [
    ...BUYER_CHECKLIST_TEMPLATES.map((t) => ({ ...t, transactionType: "BUYER" as const })),
    ...SELLER_CHECKLIST_TEMPLATES.map((t) => ({ ...t, transactionType: "SELLER" as const })),
  ];

  for (const [index, template] of rows.entries()) {
    await prisma.taskTemplate.upsert({
      where: { key: template.key },
      update: {
        transactionType: template.transactionType,
        category: template.category,
        title: template.title,
        description: template.description,
        sortOrder: index * 10,
      },
      create: {
        key: template.key,
        transactionType: template.transactionType,
        category: template.category,
        title: template.title,
        description: template.description,
        sortOrder: index * 10,
      },
    });
  }

  console.log(`Seeded ${rows.length} default task templates`);
}

async function main() {
  await seedDefaultTaskTemplates();
  await seedDevUser();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
