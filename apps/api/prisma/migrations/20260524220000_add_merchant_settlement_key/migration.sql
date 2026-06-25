-- Approach A: managed Stellar settlement wallet per merchant.
-- See apps/api/docs/architecture/merchant-settlement-onboarding.md
CREATE TABLE "MerchantSettlementKey" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "stellarAddress" TEXT NOT NULL,
    "encryptedSeed" TEXT,
    "iv" TEXT,
    "authTag" TEXT,
    "managed" BOOLEAN NOT NULL DEFAULT true,
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantSettlementKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MerchantSettlementKey_merchantId_key" ON "MerchantSettlementKey"("merchantId");
CREATE UNIQUE INDEX "MerchantSettlementKey_stellarAddress_key" ON "MerchantSettlementKey"("stellarAddress");

ALTER TABLE "MerchantSettlementKey"
  ADD CONSTRAINT "MerchantSettlementKey_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
