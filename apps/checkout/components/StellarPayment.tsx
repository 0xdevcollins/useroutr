"use client";

import { useState } from "react";
import {
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";
import { useCryptoSelect } from "@/hooks/useCryptoSelect";
import { useStellarSubmit } from "@/hooks/useStellarSubmit";

/**
 * Paying from a wallet that is already on Stellar.
 *
 * Deliberately separate from CryptoPayment rather than another branch inside
 * it: there is no bridge, no chain to switch to, no approve-then-burn pair.
 * The payer signs one payment and it settles in a single ledger close —
 * roughly five seconds, against thirty to a hundred and twenty for a CCTP
 * round trip. Sharing a component would mean threading "is this the EVM one?"
 * through every branch of it.
 */
interface StellarPaymentProps {
  paymentId: string;
  onCompleted: () => void;
}

const HORIZON = {
  "Test SDF Network ; September 2015": "https://horizon-testnet.stellar.org",
  "Public Global Stellar Network ; September 2015":
    "https://horizon.stellar.org",
} as const;

export function StellarPayment({
  paymentId,
  onCompleted,
}: StellarPaymentProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const select = useCryptoSelect(paymentId);
  const submit = useStellarSubmit(paymentId);

  const connect = async () => {
    setError(null);
    try {
      const installed = await isConnected();
      if (!installed.isConnected) {
        setError(
          "Freighter was not detected. Install it, then reload this page.",
        );
        return;
      }
      const access = await requestAccess();
      if (access.error) {
        setError(access.error);
        return;
      }
      setAddress(access.address);
    } catch (err) {
      setError(extract(err));
    }
  };

  const pay = async () => {
    if (!address) return;
    setError(null);
    setBusy(true);

    try {
      const result = await select.mutateAsync({ sourceChain: "stellar" });
      if (result.method !== "stellar" || !result.stellar) {
        throw new Error("This payment is not set up for Stellar.");
      }
      const instruction = result.stellar;

      const horizonUrl =
        HORIZON[instruction.networkPassphrase as keyof typeof HORIZON];
      if (!horizonUrl) {
        throw new Error("Unrecognised Stellar network.");
      }

      const server = new StellarSdk.Horizon.Server(horizonUrl);
      const account = await server.loadAccount(address);

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: instruction.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: instruction.destination,
            asset: new StellarSdk.Asset(
              instruction.asset.code,
              instruction.asset.issuer,
            ),
            amount: instruction.amount,
          }),
        )
        // Ties the on-chain payment back to this checkout for reconciliation.
        // The API does not trust it — it verifies the amounts itself.
        .addMemo(StellarSdk.Memo.text(instruction.memo))
        .setTimeout(180)
        .build();

      const signed = await signTransaction(tx.toXDR(), {
        networkPassphrase: instruction.networkPassphrase,
        address,
      });
      if (signed.error) throw new Error(signed.error);

      const submitted = await server.submitTransaction(
        new StellarSdk.Transaction(
          signed.signedTxXdr,
          instruction.networkPassphrase,
        ),
      );

      // Reported only after the ledger accepted it, so we never hand the API
      // a hash for a transaction that does not exist.
      await submit.mutateAsync({ txHash: submitted.hash });
      onCompleted();
    } catch (err) {
      setError(extract(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!address ? (
        <button
          onClick={connect}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
        >
          Connect Freighter
        </button>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Paying from</p>
            <p
              className="mt-1 break-all text-xs text-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {address}
            </p>
          </div>
          <button
            onClick={pay}
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Confirm in Freighter…" : "Pay with Stellar USDC"}
          </button>
          <p className="text-center text-xs text-muted-foreground">
            Settles in about five seconds. No bridging required.
          </p>
        </>
      )}

      {error && (
        <p className="rounded-lg bg-red/5 p-3 text-xs text-red">{error}</p>
      )}
    </div>
  );
}

function extract(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Something went wrong. Your funds were not sent.";
}
