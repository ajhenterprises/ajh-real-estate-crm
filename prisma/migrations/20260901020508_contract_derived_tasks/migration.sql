-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "isOverridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transactionEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_transactionEventId_key" ON "tasks"("transactionEventId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_transactionEventId_fkey" FOREIGN KEY ("transactionEventId") REFERENCES "transaction_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
