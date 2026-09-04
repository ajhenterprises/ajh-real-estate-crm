-- Merge Client into Contact: every person is one Contact row now, with a
-- single lifecycle status (contactType) instead of a separate Client
-- record. This migration preserves all existing data — nothing is
-- deleted, only consolidated.

-- Step 1: expand ContactType (LEAD/CLIENT/PAST_CLIENT/VENDOR/OTHER ->
-- LEAD/ACTIVE_CLIENT/INACTIVE_CLIENT/PAST_CLIENT/VENDOR/OTHER). Postgres
-- can't rename/remove enum values in place when the mapping depends on
-- other data, so swap in a new enum type.
ALTER TYPE "ContactType" RENAME TO "ContactType_old";
CREATE TYPE "ContactType" AS ENUM ('LEAD', 'ACTIVE_CLIENT', 'INACTIVE_CLIENT', 'PAST_CLIENT', 'VENDOR', 'OTHER');

ALTER TABLE "contacts" ADD COLUMN "clientType" "ClientType";
ALTER TABLE "contacts" ADD COLUMN "contactTypeNew" "ContactType";

-- Contacts with a linked Client row: the Client's status is the more
-- specific/authoritative signal, so it wins over the old LEAD/CLIENT/
-- PAST_CLIENT value. (A contactType other than CLIENT/PAST_CLIENT with a
-- linked Client row shouldn't happen in practice, but is handled the same
-- way defensively rather than losing the client relationship.)
UPDATE "contacts" c
SET "contactTypeNew" = CASE
    WHEN cl."status" = 'ACTIVE' THEN 'ACTIVE_CLIENT'::"ContactType"
    WHEN cl."status" = 'INACTIVE' THEN 'INACTIVE_CLIENT'::"ContactType"
    WHEN cl."status" = 'PAST' THEN 'PAST_CLIENT'::"ContactType"
  END,
  "clientType" = cl."type"
FROM "clients" cl
WHERE cl."contactId" = c."id";

-- Everyone else: carry the old value straight across (CLIENT can't occur
-- here — it always had a Client row, handled above).
UPDATE "contacts"
SET "contactTypeNew" = CASE "contactType"::text
    WHEN 'LEAD' THEN 'LEAD'::"ContactType"
    WHEN 'PAST_CLIENT' THEN 'PAST_CLIENT'::"ContactType"
    WHEN 'VENDOR' THEN 'VENDOR'::"ContactType"
    ELSE 'OTHER'::"ContactType"
  END
WHERE "contactTypeNew" IS NULL;

ALTER TABLE "contacts" DROP COLUMN "contactType";
ALTER TABLE "contacts" RENAME COLUMN "contactTypeNew" TO "contactType";
ALTER TABLE "contacts" ALTER COLUMN "contactType" SET NOT NULL;
ALTER TABLE "contacts" ALTER COLUMN "contactType" SET DEFAULT 'LEAD';
DROP TYPE "ContactType_old";

CREATE INDEX "contacts_contactType_idx" ON "contacts"("contactType");

-- Merge Client.notes into Contact.notes where the client had notes of its
-- own (most contacts won't).
UPDATE "contacts" c
SET "notes" = CASE
    WHEN c."notes" IS NULL OR c."notes" = '' THEN cl."notes"
    ELSE c."notes" || E'\n\n[Client notes]\n' || cl."notes"
  END
FROM "clients" cl
WHERE cl."contactId" = c."id" AND cl."notes" IS NOT NULL AND cl."notes" != '';

-- Step 2: Transaction.clientId -> Transaction.contactId (required, same as
-- clientId was — every transaction already has exactly one client, which
-- becomes its one contact).
ALTER TABLE "transactions" ADD COLUMN "contactId" TEXT;
UPDATE "transactions" t SET "contactId" = cl."contactId" FROM "clients" cl WHERE cl."id" = t."clientId";
ALTER TABLE "transactions" ALTER COLUMN "contactId" SET NOT NULL;
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_clientId_fkey";
DROP INDEX "transactions_clientId_idx";
ALTER TABLE "transactions" DROP COLUMN "clientId";
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "transactions_contactId_idx" ON "transactions"("contactId");

-- Step 3: Task/Showing/Document/Expense/MileageRecord already have a
-- nullable contactId alongside clientId — backfill contactId from
-- whichever row was only linked by clientId, then drop clientId.
UPDATE "tasks" t SET "contactId" = cl."contactId" FROM "clients" cl WHERE cl."id" = t."clientId" AND t."contactId" IS NULL;
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_clientId_fkey";
DROP INDEX "tasks_clientId_idx";
ALTER TABLE "tasks" DROP COLUMN "clientId";

UPDATE "showings" s SET "contactId" = cl."contactId" FROM "clients" cl WHERE cl."id" = s."clientId" AND s."contactId" IS NULL;
ALTER TABLE "showings" DROP CONSTRAINT "showings_clientId_fkey";
DROP INDEX "showings_clientId_idx";
ALTER TABLE "showings" DROP COLUMN "clientId";

UPDATE "documents" d SET "contactId" = cl."contactId" FROM "clients" cl WHERE cl."id" = d."clientId" AND d."contactId" IS NULL;
ALTER TABLE "documents" DROP CONSTRAINT "documents_clientId_fkey";
DROP INDEX "documents_clientId_idx";
ALTER TABLE "documents" DROP COLUMN "clientId";

UPDATE "expenses" e SET "contactId" = cl."contactId" FROM "clients" cl WHERE cl."id" = e."clientId" AND e."contactId" IS NULL;
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_clientId_fkey";
DROP INDEX "expenses_clientId_idx";
ALTER TABLE "expenses" DROP COLUMN "clientId";

UPDATE "mileage_records" m SET "contactId" = cl."contactId" FROM "clients" cl WHERE cl."id" = m."clientId" AND m."contactId" IS NULL;
ALTER TABLE "mileage_records" DROP CONSTRAINT "mileage_records_clientId_fkey";
DROP INDEX "mileage_records_clientId_idx";
ALTER TABLE "mileage_records" DROP COLUMN "clientId";

-- Step 4: the clients table and its now-unused status enum are no longer
-- needed — everything they held is on contacts now.
DROP TABLE "clients";
DROP TYPE "ClientStatus";
