-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_quoteId_fkey";

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "recipientId" TEXT;

-- CreateTable
CREATE TABLE "Recipient" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DestType" NOT NULL,
    "details" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recipient_merchantId_idx" ON "Recipient"("merchantId");

-- CreateIndex
CREATE INDEX "Recipient_type_idx" ON "Recipient"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_merchantId_name_key" ON "Recipient"("merchantId", "name");

-- CreateIndex
CREATE INDEX "Payout_recipientId_idx" ON "Payout"("recipientId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
