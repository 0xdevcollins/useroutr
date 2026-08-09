-- Merchant opt-in to escrow. Default off: enabling it delays the merchant's
-- own access to funds by escrowWindowSeconds, so it is their choice to make.
ALTER TABLE "Merchant" ADD COLUMN "escrowEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Merchant" ADD COLUMN "escrowWindowSeconds" INTEGER NOT NULL DEFAULT 604800;

-- Link a payment to its on-chain escrow. The chain is authoritative; these
-- columns are a mirror so the dashboard can render held balances without
-- querying Soroban on every page load.
ALTER TABLE "Payment" ADD COLUMN "escrowId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "escrowState" TEXT;
ALTER TABLE "Payment" ADD COLUMN "escrowReleaseAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Payment_escrowId_key" ON "Payment"("escrowId");
