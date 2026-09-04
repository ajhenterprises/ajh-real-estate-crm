-- Commission tracking: what the agent actually earned on a deal. Nullable
-- and never backfilled — existing transactions simply have no commission
-- on file until the agent enters one (enforced going forward by
-- updateTransactionAction before a transaction can move to CLOSED).
ALTER TABLE "transactions" ADD COLUMN "commissionAmount" DECIMAL(12,2);
