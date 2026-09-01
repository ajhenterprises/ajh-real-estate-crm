-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'PENDING_DELETION';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "deletionInitiatedAt" TIMESTAMP(3),
ADD COLUMN     "deletionInitiatedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "documents_status_deletionInitiatedAt_idx" ON "documents"("status", "deletionInitiatedAt");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_deletionInitiatedByUserId_fkey" FOREIGN KEY ("deletionInitiatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
