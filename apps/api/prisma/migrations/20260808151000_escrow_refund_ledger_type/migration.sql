-- A dispute resolved wholly or partly for the payer debits the held credit
-- back out. None of the existing types describe that: PAYOUT_DEBIT means a
-- payout left the balance, which is a different event entirely.
ALTER TYPE "MerchantLedgerEntryType" ADD VALUE 'ESCROW_REFUND';
