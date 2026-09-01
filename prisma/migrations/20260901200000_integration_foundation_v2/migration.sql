-- CreateEnum
CREATE TYPE "InternalRecordType" AS ENUM ('CONTACT', 'TRANSACTION', 'TASK');

-- CreateEnum
CREATE TYPE "IntegrationEventType" AS ENUM ('CONNECTED', 'DISCONNECTED', 'SYNC_STARTED', 'SYNC_COMPLETED', 'SYNC_FAILED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- DropForeignKey
ALTER TABLE "external_sync_links" DROP CONSTRAINT "external_sync_links_contactId_fkey";

-- DropForeignKey
ALTER TABLE "external_sync_links" DROP CONSTRAINT "external_sync_links_integrationId_fkey";

-- DropIndex
DROP INDEX "external_sync_links_contactId_idx";

-- DropIndex
DROP INDEX "external_sync_links_integrationId_idx";

-- DropIndex
DROP INDEX "external_sync_links_provider_externalId_key";

-- AlterTable
ALTER TABLE "external_sync_links" DROP COLUMN "contactId",
ADD COLUMN     "internalRecordId" TEXT NOT NULL,
ADD COLUMN     "internalRecordType" "InternalRecordType" NOT NULL,
ADD COLUMN     "ownerId" TEXT NOT NULL,
ALTER COLUMN "integrationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "encryptedCredentials" TEXT;

-- CreateTable
CREATE TABLE "integration_events" (
    "id" TEXT NOT NULL,
    "type" "IntegrationEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "integrationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "ExternalProvider" NOT NULL,
    "integrationId" TEXT,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "processingStatus" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_events_integrationId_createdAt_idx" ON "integration_events"("integrationId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_events_integrationId_idx" ON "webhook_events"("integrationId");

-- CreateIndex
CREATE INDEX "webhook_events_processingStatus_idx" ON "webhook_events"("processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_externalEventId_key" ON "webhook_events"("provider", "externalEventId");

-- CreateIndex
CREATE INDEX "external_sync_links_internalRecordType_internalRecordId_idx" ON "external_sync_links"("internalRecordType", "internalRecordId");

-- CreateIndex
CREATE INDEX "external_sync_links_ownerId_idx" ON "external_sync_links"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "external_sync_links_integrationId_internalRecordType_intern_key" ON "external_sync_links"("integrationId", "internalRecordType", "internalRecordId", "externalId");

-- AddForeignKey
ALTER TABLE "external_sync_links" ADD CONSTRAINT "external_sync_links_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_sync_links" ADD CONSTRAINT "external_sync_links_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
