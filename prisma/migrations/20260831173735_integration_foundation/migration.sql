-- CreateEnum
CREATE TYPE "ContactActivityType" AS ENUM ('CREATED', 'NOTE_ADDED', 'STATUS_CHANGED', 'SYNCED', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactSource" ADD VALUE 'BULLSEYE';
ALTER TYPE "ContactSource" ADD VALUE 'FACEBOOK';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExternalProvider" ADD VALUE 'BULLSEYE';
ALTER TYPE "ExternalProvider" ADD VALUE 'WEBSITE';
ALTER TYPE "ExternalProvider" ADD VALUE 'FACEBOOK';

-- AlterTable
ALTER TABLE "external_sync_links" ADD COLUMN     "integrationId" TEXT;

-- CreateTable
CREATE TABLE "contact_activities" (
    "id" TEXT NOT NULL,
    "type" "ContactActivityType" NOT NULL,
    "description" TEXT NOT NULL,
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "externalEventId" TEXT,
    "metadata" JSONB,
    "contactId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "settings" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_activities_contactId_idx" ON "contact_activities"("contactId");

-- CreateIndex
CREATE INDEX "contact_activities_source_externalEventId_idx" ON "contact_activities"("source", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_ownerId_provider_key" ON "integrations"("ownerId", "provider");

-- CreateIndex
CREATE INDEX "external_sync_links_integrationId_idx" ON "external_sync_links"("integrationId");

-- AddForeignKey
ALTER TABLE "contact_activities" ADD CONSTRAINT "contact_activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sync_links" ADD CONSTRAINT "external_sync_links_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
