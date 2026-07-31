-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_CONFIRMATION';

-- CreateEnum
CREATE TYPE "RecurringPayoutFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "MerchantLedgerEntryType" AS ENUM ('CREDIT', 'PAYOUT_DEBIT', 'PAYOUT_RELEASE');

-- AlterTable
ALTER TABLE "Payout"
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "recurringPayoutId" TEXT;

-- CreateTable
CREATE TABLE "RecurringPayout" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "recipientId" TEXT,
  "recipientName" TEXT NOT NULL,
  "destinationType" "DestType" NOT NULL,
  "destination" JSONB NOT NULL,
  "amount" DECIMAL(36,18) NOT NULL,
  "currency" TEXT NOT NULL,
  "frequency" "RecurringPayoutFrequency" NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecurringPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantBalance" (
  "merchantId" TEXT NOT NULL,
  "availableAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "reservedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MerchantBalance_pkey" PRIMARY KEY ("merchantId", "currency")
);

-- CreateTable
CREATE TABLE "MerchantLedgerEntry" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "payoutId" TEXT,
  "paymentId" TEXT,
  "type" "MerchantLedgerEntryType" NOT NULL,
  "amount" DECIMAL(36,18) NOT NULL,
  "currency" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MerchantLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_scheduledAt_idx" ON "Payout"("scheduledAt");

-- CreateIndex
CREATE INDEX "Payout_recurringPayoutId_idx" ON "Payout"("recurringPayoutId");

-- CreateIndex
CREATE INDEX "RecurringPayout_merchantId_idx" ON "RecurringPayout"("merchantId");

-- CreateIndex
CREATE INDEX "RecurringPayout_active_nextRunAt_idx" ON "RecurringPayout"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringPayout_recipientId_idx" ON "RecurringPayout"("recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantLedgerEntry_paymentId_type_key" ON "MerchantLedgerEntry"("paymentId", "type");

-- CreateIndex
CREATE INDEX "MerchantLedgerEntry_merchantId_createdAt_idx" ON "MerchantLedgerEntry"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantLedgerEntry_payoutId_idx" ON "MerchantLedgerEntry"("payoutId");

-- CreateIndex
CREATE INDEX "MerchantLedgerEntry_paymentId_idx" ON "MerchantLedgerEntry"("paymentId");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_recurringPayoutId_fkey" FOREIGN KEY ("recurringPayoutId") REFERENCES "RecurringPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayout" ADD CONSTRAINT "RecurringPayout_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayout" ADD CONSTRAINT "RecurringPayout_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantBalance" ADD CONSTRAINT "MerchantBalance_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantLedgerEntry" ADD CONSTRAINT "MerchantLedgerEntry_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
