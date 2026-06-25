"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useSwitchChain,
  useChainId,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  useCryptoSelect,
  type CryptoSelectResponse,
} from "@/hooks/useCryptoSelect";
import { useCryptoStatus } from "@/hooks/useCryptoStatus";

/**
 * Crypto payment via Circle CCTP V2 (EVM → Stellar). The customer:
 *
 *   1. Connects a wallet (RainbowKit)
 *   2. Picks one of the 5 enabled CCTP V2 EVM chains
 *   3. Locks a quote — API returns wallet-signable approve + burn calldata
 *   4. Signs approve(USDC, TokenMessengerV2, amount)
 *   5. Signs depositForBurnWithHook(...) — calldata pre-encoded server-side
 *   6. Notifies API → backend enqueues attestation polling worker
 *   7. Page polls `/crypto-status` every 3s until COMPLETED
 *
 * The 30s quote countdown is enforced by the API on submit, not the
 * client — the page is allowed to be sloppy about timing because the
 * worst case is a "quote expired" error on burn-submitted with a
 * re-quote retry.
 */

const SUPPORTED_CHAINS = [
  { id: "ethereum", label: "Ethereum" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "optimism", label: "Optimism" },
  { id: "avalanche", label: "Avalanche" },
] as const;

type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];

interface CryptoPaymentProps {
  paymentId: string;
  merchantAmount: number;
  merchantCurrency: string;
}

export function CryptoPayment({
  paymentId,
  merchantAmount,
  merchantCurrency,
}: CryptoPaymentProps) {
  const [selectedChain, setSelectedChain] = useState<SupportedChainId>("base");
  const [quote, setQuote] = useState<CryptoSelectResponse | null>(null);
  const [step, setStep] = useState<
    "pick" | "approving" | "burning" | "submitted" | "done" | "failed"
  >("pick");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<`0x${string}` | null>(null);

  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();

  const select = useCryptoSelect(paymentId);
  const status = useCryptoStatus(paymentId, step === "submitted");

  // Wait for the approve tx receipt before triggering the burn — wagmi
  // hook does the polling for us against the connected chain's RPC.
  const approveReceipt = useWaitForTransactionReceipt({
    hash: approveTxHash ?? undefined,
    query: { enabled: !!approveTxHash },
  });

  /* ── Step transitions driven by status polling ────────────────────── */

  useEffect(() => {
    if (!status.data) return;
    if (status.data.status === "COMPLETED") {
      setStep("done");
    } else if (status.data.status === "FAILED") {
      setStep("failed");
      setErrorMsg(
        status.data.error ?? "Payment failed during cross-chain settlement.",
      );
    }
  }, [status.data]);

  /* ── Actions ──────────────────────────────────────────────────────── */

  const handleLockQuote = async () => {
    setErrorMsg(null);
    try {
      const result = await select.mutateAsync({ sourceChain: selectedChain });
      setQuote(result);
      // Switch wallet to the chain the quote targets — saves a manual click
      // in MetaMask. The user can decline; we just won't auto-trigger sign.
      if (currentChainId !== result.wallet.chainId) {
        await switchChainAsync({ chainId: result.wallet.chainId });
      }
    } catch (err) {
      setErrorMsg(extractMessage(err));
    }
  };

  const handleApproveAndBurn = async () => {
    if (!quote) return;
    setErrorMsg(null);

    // Defensive: make sure the wallet is on the right chain. switchChainAsync
    // is idempotent on no-op so a re-call is cheap.
    if (currentChainId !== quote.wallet.chainId) {
      try {
        await switchChainAsync({ chainId: quote.wallet.chainId });
      } catch (err) {
        setErrorMsg(`Please switch your wallet to chainId ${quote.wallet.chainId}`);
        return;
      }
    }

    // Step 1: approve
    setStep("approving");
    let approveHash: `0x${string}`;
    try {
      approveHash = await sendTransactionAsync({
        to: quote.wallet.approve.to as `0x${string}`,
        data: quote.wallet.approve.data as `0x${string}`,
        value: BigInt(0),
      });
      setApproveTxHash(approveHash);
    } catch (err) {
      setStep("pick");
      setErrorMsg(extractMessage(err));
      return;
    }

    // Wait for approve receipt — wagmi hook handles this via approveReceipt
    // and `useEffect` chain below. To keep the action flow linear here,
    // poll inline with a small loop instead. Cast through `unknown` because
    // wagmi's refetch signature is too narrow for a generic helper.
    try {
      await pollForReceipt(
        approveReceipt.refetch as unknown as PollableRefetch,
      );
    } catch (err) {
      setStep("pick");
      setErrorMsg(`Approve transaction failed: ${extractMessage(err)}`);
      return;
    }

    // Step 2: burn
    setStep("burning");
    let burnHash: `0x${string}`;
    try {
      burnHash = await sendTransactionAsync({
        to: quote.wallet.burn.to as `0x${string}`,
        data: quote.wallet.burn.data as `0x${string}`,
        value: BigInt(0),
      });
      setBurnTxHash(burnHash);
    } catch (err) {
      setStep("pick");
      setErrorMsg(extractMessage(err));
      return;
    }

    // Step 3: notify backend, kick off attestation worker, start polling
    try {
      await api.post(`/checkout/${paymentId}/burn-submitted`, {
        sourceTxHash: burnHash,
      });
      setStep("submitted");
    } catch (err) {
      setStep("failed");
      setErrorMsg(
        `Burn submitted on-chain but the API rejected the notification. Reload to refresh status. (${extractMessage(err)})`,
      );
    }
  };

  /* ── Render ───────────────────────────────────────────────────────── */

  if (step === "done") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <CheckCircle
          size={48}
          className="mx-auto text-green-500"
          strokeWidth={1.5}
        />
        <h2 className="mt-4 font-display text-lg font-semibold text-foreground">
          Payment complete
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          USDC delivered on Stellar.
        </p>
        {status.data?.destExplorerUrl && (
          <a
            href={status.data.destExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            View settlement on Stellar
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    );
  }

  if (step === "failed") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircle
          size={40}
          className="mx-auto text-destructive"
          strokeWidth={1.5}
        />
        <h2 className="mt-3 font-display text-base font-semibold text-foreground">
          Payment failed
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {errorMsg ?? "Something went wrong during cross-chain settlement."}
        </p>
        <button
          onClick={() => {
            setStep("pick");
            setQuote(null);
            setApproveTxHash(null);
            setBurnTxHash(null);
            setErrorMsg(null);
          }}
          className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Try again
        </button>
      </div>
    );
  }

  if (step === "submitted" || step === "burning" || step === "approving") {
    return <CryptoProgress step={step} status={status.data?.status} sourceExplorerUrl={status.data?.sourceExplorerUrl ?? null} burnTxHash={burnTxHash} />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-foreground">
        Pay with crypto
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pay in USDC on the chain of your choice. Settles on Stellar in 8–20
        seconds via Circle&apos;s CCTP V2.
      </p>

      {/* Chain picker */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-foreground">
          Send USDC from
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SUPPORTED_CHAINS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedChain(c.id);
                setQuote(null); // invalidate stale quote on chain change
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                selectedChain === c.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-transparent text-foreground hover:border-primary/40 hover:bg-primary/5"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quote display */}
      {quote && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 font-mono text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">You send</span>
            <span className="font-semibold text-foreground">
              {quote.quote.fromAmount} USDC
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Network fee</span>
            <span className="text-muted-foreground">
              {quote.quote.fee} {quote.quote.toAsset} ({quote.quote.feeBps / 100}%)
            </span>
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Merchant gets</span>
              <span className="font-semibold text-foreground">
                {merchantAmount.toFixed(2)} {merchantCurrency}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Quote locked for {quote.quote.expiresInSeconds}s.
          </p>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0 text-destructive"
          />
          <span className="text-destructive">{errorMsg}</span>
        </div>
      )}

      {/* CTA */}
      <div className="mt-5 space-y-2">
        {!isConnected ? (
          <button
            type="button"
            onClick={() => openConnectModal?.()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
          >
            <Wallet size={18} />
            Connect wallet
          </button>
        ) : !quote ? (
          <button
            type="button"
            disabled={select.isPending}
            onClick={handleLockQuote}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {select.isPending ? (
              <>
                <Clock size={18} className="animate-spin" />
                Locking quote…
              </>
            ) : (
              <>
                <ArrowRight size={18} />
                Lock quote
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleApproveAndBurn}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
          >
            <ArrowRight size={18} />
            Approve &amp; Pay {quote.quote.fromAmount} USDC
          </button>
        )}

        {isConnected && address && (
          <p className="text-center text-xs text-muted-foreground">
            Connected: {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Sub-component: progress while waiting on chain + attestation ───── */

function CryptoProgress({
  step,
  status,
  sourceExplorerUrl,
  burnTxHash,
}: {
  step: "approving" | "burning" | "submitted";
  status?: string;
  sourceExplorerUrl: string | null;
  burnTxHash: string | null;
}) {
  const lines: { label: string; state: "active" | "pending" | "done" }[] = [
    {
      label: "Approve USDC spend",
      state:
        step === "approving" ? "active" : "done",
    },
    {
      label: "Burn on source chain",
      state:
        step === "burning"
          ? "active"
          : step === "submitted"
            ? "done"
            : "pending",
    },
    {
      label: "Circle attestation",
      state:
        status === "PROCESSING" || status === "COMPLETED"
          ? "done"
          : step === "submitted"
            ? "active"
            : "pending",
    },
    {
      label: "Mint on Stellar",
      state: status === "COMPLETED" ? "done" : "pending",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-foreground">
        Bridging your payment
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Hang tight — settlement takes 8–20 seconds via Circle CCTP V2.
      </p>

      <ol className="mt-5 space-y-3">
        {lines.map((line, i) => (
          <li key={i} className="flex items-center gap-3">
            <span
              className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold ${
                line.state === "done"
                  ? "bg-green-100 text-green-700"
                  : line.state === "active"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {line.state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={`text-sm ${
                line.state === "pending"
                  ? "text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {line.label}
              {line.state === "active" && (
                <Clock size={14} className="ml-2 inline animate-spin" />
              )}
            </span>
          </li>
        ))}
      </ol>

      {(burnTxHash || sourceExplorerUrl) && (
        <a
          href={sourceExplorerUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          View burn transaction
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function extractMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Poll a wagmi `refetch` until it resolves to a confirmed receipt or
 * throws. Wraps the awkward `useWaitForTransactionReceipt` ergonomics
 * for an imperative flow (we want one linear async chain, not a useEffect
 * graph). Bounded by 60 attempts × 2s = 2 minutes — receipts on testnet
 * should land in <10 attempts.
 */
/**
 * Erased refetch signature — wagmi's actual type is much narrower but we
 * only need three fields and a void-arg call shape.
 */
type PollableRefetch = (...args: unknown[]) => Promise<{
  data?: unknown;
  isError?: boolean;
  error?: Error | null;
}>;

async function pollForReceipt(refetch: PollableRefetch): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const result = await refetch();
    if (result.data) return;
    if (result.isError) {
      throw result.error ?? new Error("Receipt fetch failed");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Receipt not confirmed within 2 minutes — check your wallet");
}
