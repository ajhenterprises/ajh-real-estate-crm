-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BUSINESS_BANK_ACCOUNT', 'BUSINESS_CREDIT_CARD', 'PERSONAL_CARD', 'CASH', 'CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "DeductibilityStatus" AS ENUM ('NEEDS_REVIEW', 'DEDUCTIBLE', 'NOT_DEDUCTIBLE');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "expenseId" TEXT;

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vendor" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "businessPurpose" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'OTHER',
    "deductibleStatus" "DeductibilityStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "businessUsePercent" INTEGER,
    "notes" TEXT,
    "transactionId" TEXT,
    "clientId" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mileage_records" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "startLocation" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "businessPurpose" TEXT NOT NULL,
    "miles" DECIMAL(8,1) NOT NULL,
    "transactionId" TEXT,
    "clientId" TEXT,
    "contactId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mileage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_categories_ownerId_idx" ON "expense_categories"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_ownerId_name_key" ON "expense_categories"("ownerId", "name");

-- CreateIndex
CREATE INDEX "expenses_ownerId_taxYear_idx" ON "expenses"("ownerId", "taxYear");

-- CreateIndex
CREATE INDEX "expenses_ownerId_categoryId_idx" ON "expenses"("ownerId", "categoryId");

-- CreateIndex
CREATE INDEX "expenses_transactionId_idx" ON "expenses"("transactionId");

-- CreateIndex
CREATE INDEX "expenses_clientId_idx" ON "expenses"("clientId");

-- CreateIndex
CREATE INDEX "expenses_contactId_idx" ON "expenses"("contactId");

-- CreateIndex
CREATE INDEX "mileage_records_ownerId_taxYear_idx" ON "mileage_records"("ownerId", "taxYear");

-- CreateIndex
CREATE INDEX "mileage_records_transactionId_idx" ON "mileage_records"("transactionId");

-- CreateIndex
CREATE INDEX "mileage_records_clientId_idx" ON "mileage_records"("clientId");

-- CreateIndex
CREATE INDEX "mileage_records_contactId_idx" ON "mileage_records"("contactId");

-- CreateIndex
CREATE INDEX "documents_expenseId_idx" ON "documents"("expenseId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mileage_records" ADD CONSTRAINT "mileage_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default expense categories (shared, ownerId NULL — visible to every
-- user; see prisma/schema.prisma's ExpenseCategory comment). Stable,
-- readable ids rather than random ones since these are fixed reference
-- rows referenced by this migration alone. Postgres treats NULL as
-- distinct from NULL in unique constraints, so `ON CONFLICT ("ownerId",
-- "name") DO NOTHING` would NOT actually prevent duplicates here (every
-- ownerId is NULL) if this file were ever re-run outside Prisma's normal
-- migration tracking — WHERE NOT EXISTS below is used instead specifically
-- because it handles NULL correctly.
INSERT INTO "expense_categories" ("id", "name", "isSystemDefault", "ownerId", "createdAt")
SELECT v.id, v.name, true, NULL, CURRENT_TIMESTAMP
FROM (VALUES
    ('expcat_advertising_marketing', 'Advertising & Marketing'),
    ('expcat_mls_association', 'MLS / Association'),
    ('expcat_brokerage_fees', 'Brokerage Fees'),
    ('expcat_lead_generation', 'Lead Generation'),
    ('expcat_client_gifts', 'Client Gifts'),
    ('expcat_signs_printing', 'Signs & Printing'),
    ('expcat_photography_video', 'Photography / Video'),
    ('expcat_software_subscriptions', 'Software & Subscriptions'),
    ('expcat_office_supplies', 'Office Supplies'),
    ('expcat_phone_internet', 'Phone / Internet'),
    ('expcat_education_training', 'Education & Training'),
    ('expcat_professional_services', 'Professional Services'),
    ('expcat_insurance', 'Insurance'),
    ('expcat_travel', 'Travel'),
    ('expcat_meals', 'Meals'),
    ('expcat_vehicle_mileage', 'Vehicle / Mileage'),
    ('expcat_postage_shipping', 'Postage & Shipping'),
    ('expcat_bank_fees', 'Bank / Payment Processing Fees'),
    ('expcat_home_office', 'Home Office'),
    ('expcat_other', 'Other')
) AS v(id, name)
WHERE NOT EXISTS (
    SELECT 1 FROM "expense_categories" ec WHERE ec."ownerId" IS NULL AND ec."name" = v.name
);
