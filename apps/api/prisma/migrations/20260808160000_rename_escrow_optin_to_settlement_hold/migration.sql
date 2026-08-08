-- Renamed from escrowEnabled/escrowWindowSeconds. Only a Stellar-native
-- payer's funds can actually be held in the escrow contract: a CCTP payer has
-- no Stellar account to authorize a lock, and no address the contract could
-- refund to on a dispute. Calling the merchant-facing switch "escrow" implied
-- a guarantee the chain does not make for most payments.
ALTER TABLE "Merchant" RENAME COLUMN "escrowEnabled" TO "settlementHoldEnabled";
ALTER TABLE "Merchant" RENAME COLUMN "escrowWindowSeconds" TO "settlementHoldSeconds";
