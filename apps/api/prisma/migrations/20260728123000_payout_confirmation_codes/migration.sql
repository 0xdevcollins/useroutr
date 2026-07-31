-- AlterTable
ALTER TABLE "Payout"
  ADD COLUMN "confirmationCodeHash" TEXT,
  ADD COLUMN "confirmationCodeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "confirmationAttempts" INTEGER NOT NULL DEFAULT 0;
