-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('MANUAL', 'TRANSACTION_TEMPLATE', 'FUTURE_CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskTemplateDueDateAnchor" AS ENUM ('TRANSACTION_CREATED', 'EXPECTED_CLOSING_DATE');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "category" TEXT,
ADD COLUMN     "templateId" TEXT,
DROP COLUMN "source",
ADD COLUMN     "source" "TaskSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDateOffsetDays" INTEGER,
    "dueDateAnchor" "TaskTemplateDueDateAnchor",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_templates_key_key" ON "task_templates"("key");

-- CreateIndex
CREATE INDEX "task_templates_transactionType_isActive_sortOrder_idx" ON "task_templates"("transactionType", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "tasks_templateId_idx" ON "tasks"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_transactionId_templateId_key" ON "tasks"("transactionId", "templateId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

