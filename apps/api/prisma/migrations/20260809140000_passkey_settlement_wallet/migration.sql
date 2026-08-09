-- Self-custodied settlement wallets. A passkey wallet has no seed: the
-- merchant's device holds the key, so the encrypted-seed columns stay null
-- and the WebAuthn credential identifies it instead.
ALTER TABLE "MerchantSettlementKey" ADD COLUMN "passkeyCredentialId" TEXT;
ALTER TABLE "MerchantSettlementKey" ADD COLUMN "smartWalletAddress" TEXT;
