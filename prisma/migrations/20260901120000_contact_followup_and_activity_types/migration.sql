-- AlterEnum
ALTER TYPE "ContactActivityType" ADD VALUE 'CALL';
ALTER TYPE "ContactActivityType" ADD VALUE 'EMAIL';
ALTER TYPE "ContactActivityType" ADD VALUE 'TEXT';
ALTER TYPE "ContactActivityType" ADD VALUE 'SHOWING';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "nextFollowUpDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_nextFollowUpDate_idx" ON "contacts"("nextFollowUpDate");
