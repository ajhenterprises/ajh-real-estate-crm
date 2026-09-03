-- AlterTable
ALTER TABLE "showings" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- CreateIndex
CREATE UNIQUE INDEX "showings_externalId_key" ON "showings"("externalId");
