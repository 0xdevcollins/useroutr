-- Paper trail for money leaving custody. Its own table rather than a ledger
-- entry: this is the event most likely to be disputed later, and it should
-- survive independently of balance bookkeeping.
CREATE TABLE "SettlementWithdrawal" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "asset" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "stellarTxHash" TEXT,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementWithdrawal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SettlementWithdrawal_merchantId_createdAt_idx"
    ON "SettlementWithdrawal"("merchantId", "createdAt");

ALTER TABLE "SettlementWithdrawal" ADD CONSTRAINT "SettlementWithdrawal_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
