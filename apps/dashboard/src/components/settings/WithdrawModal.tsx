"use client";

import { useState } from "react";
import { ArrowUpRight, AlertCircle } from "lucide-react";
import { Button } from "@useroutr/ui";
import { useWithdrawSettlement } from "@/hooks/useSettings";

interface WithdrawModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Moves USDC out of the managed settlement wallet.
 *
 * Deliberately plain about the irreversible parts: a Stellar payment cannot be
 * recalled, and the destination must already hold a USDC trustline. The API
 * checks both, but a merchant reading an error after the fact is a worse
 * experience than being told before they type an address.
 */
export function WithdrawModal({
  open,
  onClose,
  onSuccess,
  onError,
}: WithdrawModalProps) {
  const [destinationAddress, setDestinationAddress] = useState("");
  const [amount, setAmount] = useState("");
  const withdraw = useWithdrawSettlement();

  if (!open) return null;

  // Mirrors the server's StrKey check closely enough to catch a typo before a
  // round trip, without pretending to be authoritative.
  const addressLooksValid = /^G[A-Z2-7]{55}$/.test(destinationAddress.trim());
  const amountLooksValid =
    amount.trim() === "all" || /^\d+(\.\d{1,7})?$/.test(amount.trim());
  const canSubmit = addressLooksValid && amountLooksValid;

  const submit = () => {
    withdraw.mutate(
      { destinationAddress: destinationAddress.trim(), amount: amount.trim() },
      {
        onSuccess: (data) => {
          onSuccess(
            `Withdrew ${data.amount} USDC — ${data.stellarTxHash.slice(0, 8)}…`,
          );
          setDestinationAddress("");
          setAmount("");
          onClose();
        },
        onError: (err) =>
          onError(err.message || "Withdrawal failed. Nothing was sent."),
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdraw-title"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="withdraw-title"
          className="font-semibold text-foreground flex items-center gap-2"
        >
          <ArrowUpRight size={18} className="text-primary" />
          Withdraw USDC
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Sends from your managed settlement wallet on Stellar.
        </p>

        <label
          htmlFor="withdraw-destination"
          className="mt-5 block text-xs font-medium text-foreground"
        >
          Destination address
        </label>
        <input
          id="withdraw-destination"
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          placeholder="G…"
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
          style={{ fontFamily: "var(--font-mono)" }}
        />
        {destinationAddress.length > 0 && !addressLooksValid && (
          <p className="mt-1 text-xs text-red-600">
            That is not a Stellar public key. It should start with G and be 56
            characters.
          </p>
        )}

        <label
          htmlFor="withdraw-amount"
          className="mt-4 block text-xs font-medium text-foreground"
        >
          Amount
        </label>
        <input
          id="withdraw-amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder='e.g. 100.50, or "all"'
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs text-muted-foreground">
            Stellar payments cannot be reversed. The destination must already
            hold a USDC trustline, or the transfer will be rejected.
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={withdraw.isPending}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            loading={withdraw.isPending}
            className="flex-1"
          >
            Withdraw
          </Button>
        </div>
      </div>
    </div>
  );
}
