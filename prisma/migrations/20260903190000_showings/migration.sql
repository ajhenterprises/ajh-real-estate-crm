-- CreateEnum
CREATE TYPE "ShowingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "showings" (
    "id" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ShowingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "contactId" TEXT,
    "clientId" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "showings_ownerId_idx" ON "showings"("ownerId");

-- CreateIndex
CREATE INDEX "showings_scheduledAt_idx" ON "showings"("scheduledAt");

-- CreateIndex
CREATE INDEX "showings_contactId_idx" ON "showings"("contactId");

-- CreateIndex
CREATE INDEX "showings_clientId_idx" ON "showings"("clientId");

-- AddForeignKey
ALTER TABLE "showings" ADD CONSTRAINT "showings_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showings" ADD CONSTRAINT "showings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showings" ADD CONSTRAINT "showings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
