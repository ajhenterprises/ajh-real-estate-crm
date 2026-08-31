-- CreateEnum
CREATE TYPE "ContractPeriodDayType" AS ENUM ('CALENDAR', 'BUSINESS');

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "description" TEXT,
ADD COLUMN     "fileSize" INTEGER NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transaction_events" ADD COLUMN     "calculatedDate" TIMESTAMP(3),
ADD COLUMN     "calculationBasis" TEXT,
ADD COLUMN     "contractInformationId" TEXT,
ADD COLUMN     "isCalculated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overrideNote" TEXT;

-- CreateTable
CREATE TABLE "contract_information" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "buyerNames" TEXT,
    "sellerNames" TEXT,
    "propertyAddress" TEXT,
    "propertyCity" TEXT,
    "propertyState" TEXT,
    "propertyZip" TEXT,
    "purchasePrice" DECIMAL(12,2),
    "earnestMoneyAmount" DECIMAL(12,2),
    "contractEffectiveDate" TIMESTAMP(3),
    "expectedClosingDate" TIMESTAMP(3),
    "earnestMoneyDueDate" TIMESTAMP(3),
    "inspectionPeriodDays" INTEGER,
    "inspectionPeriodDayType" "ContractPeriodDayType",
    "financingPeriodDays" INTEGER,
    "financingPeriodDayType" "ContractPeriodDayType",
    "appraisalPeriodDays" INTEGER,
    "appraisalPeriodDayType" "ContractPeriodDayType",
    "titlePeriodDays" INTEGER,
    "titlePeriodDayType" "ContractPeriodDayType",
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_information_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_information_documentId_key" ON "contract_information"("documentId");

-- CreateIndex
CREATE INDEX "contract_information_transactionId_idx" ON "contract_information"("transactionId");

-- CreateIndex
CREATE INDEX "contract_information_ownerId_idx" ON "contract_information"("ownerId");

-- CreateIndex
CREATE INDEX "transaction_events_contractInformationId_idx" ON "transaction_events"("contractInformationId");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_events_contractInformationId_eventType_key" ON "transaction_events"("contractInformationId", "eventType");

-- AddForeignKey
ALTER TABLE "transaction_events" ADD CONSTRAINT "transaction_events_contractInformationId_fkey" FOREIGN KEY ("contractInformationId") REFERENCES "contract_information"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_information" ADD CONSTRAINT "contract_information_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_information" ADD CONSTRAINT "contract_information_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_information" ADD CONSTRAINT "contract_information_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_information" ADD CONSTRAINT "contract_information_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

