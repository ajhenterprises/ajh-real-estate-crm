-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('TASK', 'FOLLOW_UP', 'TRANSACTION_DEADLINE');

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tasksEnabled" BOOLEAN NOT NULL DEFAULT true,
    "followUpsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "transactionDeadlinesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taskReminderMinutesBefore" INTEGER NOT NULL DEFAULT 0,
    "followUpReminderMinutesBefore" INTEGER NOT NULL DEFAULT 0,
    "transactionReminderDaysBefore" INTEGER[] DEFAULT ARRAY[3, 1]::INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "scheduled_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "offsetKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_notifications_sourceType_sourceId_offsetKey_key" ON "scheduled_notifications"("sourceType", "sourceId", "offsetKey");

-- CreateIndex
CREATE INDEX "scheduled_notifications_userId_sendAt_idx" ON "scheduled_notifications"("userId", "sendAt");

-- AddForeignKey
ALTER TABLE "scheduled_notifications" ADD CONSTRAINT "scheduled_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
