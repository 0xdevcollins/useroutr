-- AlterTable
ALTER TABLE "Payout"
  ADD COLUMN "confirmationCodeHash" TEXT,
  ADD COLUMN "confirmationCodeExpiresAt" TIMESTAMP(3);
