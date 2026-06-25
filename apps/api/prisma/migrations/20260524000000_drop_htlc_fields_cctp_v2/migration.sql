/*
  CCTP V2 cutover — drop the HTLC-era columns from Payment and add the
  CCTP nonce + attestation fields used by the new bridging flow.

  Removed columns:
    - sourceLockId   (source-chain HTLC lock ID)
    - stellarLockId  (Stellar Soroban HTLC lock ID)
    - hashlock       (sha256 of HTLC secret)
    - htlcSecret     (the secret itself, hex-encoded)
    - secretRevealed (whether the preimage had been broadcast)

  Added columns:
    - cctpNonce       (Circle Iris nonce extracted from the burn receipt)
    - cctpAttestation (Iris attestation blob, populated before destination mint)

  These columns were already unused in code as of PR D (HTLC modules deleted);
  this migration brings the schema in line with the code.
*/

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "sourceLockId",
DROP COLUMN "stellarLockId",
DROP COLUMN "hashlock",
DROP COLUMN "htlcSecret",
DROP COLUMN "secretRevealed",
ADD COLUMN "cctpNonce" TEXT,
ADD COLUMN "cctpAttestation" TEXT;
