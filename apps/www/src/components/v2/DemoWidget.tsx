"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RECEIVE_METHODS,
  SEND_DESTINATIONS,
  convertFromUSD,
  formatUSD,
  getReceiveRoute,
  getSendRoute,
  runDemoRoute,
  type ReceiveMethod,
  type RouteResult,
  type SendDestination,
} from "@/lib/demo";
import { BrandLogo } from "./BrandLogo";

type Tab = "receive" | "send";
type Phase = "form" | "running" | "done";

const ease = [0.22, 1, 0.36, 1] as const;
const fade = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.32, ease },
};

export function DemoWidget() {
  const [tab, setTab] = useState<Tab>("receive");
  const [phase, setPhase] = useState<Phase>("form");

  const [amount, setAmount] = useState(100);
  const [methodId, setMethodId] = useState<string>("usdc-stellar");

  const [sendAmount, setSendAmount] = useState(250);
  const [recipient, setRecipient] = useState("alex.useroutr");
  const [destId, setDestId] = useState<string>("stellar");

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  const reset = () => {
    setPhase("form");
    setRoute(null);
    setStepIdx(0);
  };

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setTab(t);
    reset();
  };

  const submit = async () => {
    const r = tab === "receive" ? getReceiveRoute(methodId) : getSendRoute(destId);
    setRoute(r);
    setStepIdx(0);
    setPhase("running");
    await runDemoRoute(r.steps, setStepIdx);
    setPhase("done");
  };

  const activeAmount = tab === "receive" ? amount : sendAmount;
  const activeMethod = RECEIVE_METHODS.find((m) => m.id === methodId);
  const activeDest = SEND_DESTINATIONS.find((d) => d.id === destId);

  return (
    <div className="relative mx-auto w-full max-w-[540px]">
      {/* Soft halo */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-soft/55 blur-3xl md:size-[560px]" />

      <div className="overflow-hidden rounded-3xl border border-rule bg-bg-card shadow-[0_40px_100px_-40px_rgba(14,14,12,0.32)]">
        {/* Tab strip */}
        <div className="flex gap-1 border-b border-rule p-2">
          <TabButton
            label="Receive a payment"
            icon={<ArrowDownLeft className="size-3.5" strokeWidth={1.6} />}
            active={tab === "receive"}
            onClick={() => switchTab("receive")}
          />
          <TabButton
            label="Send money"
            icon={<ArrowUpRight className="size-3.5" strokeWidth={1.6} />}
            active={tab === "send"}
            onClick={() => switchTab("send")}
          />
        </div>

        {/* Body */}
        <div className="px-5 py-6 md:px-7 md:py-7">
          <AnimatePresence mode="wait">
            {phase === "form" && tab === "receive" && (
              <motion.div key="receive-form" {...fade}>
                <ReceiveForm
                  amount={amount}
                  onAmount={setAmount}
                  methodId={methodId}
                  onMethod={setMethodId}
                  onSubmit={submit}
                />
              </motion.div>
            )}
            {phase === "form" && tab === "send" && (
              <motion.div key="send-form" {...fade}>
                <SendForm
                  amount={sendAmount}
                  onAmount={setSendAmount}
                  recipient={recipient}
                  onRecipient={setRecipient}
                  destId={destId}
                  onDest={setDestId}
                  onSubmit={submit}
                />
              </motion.div>
            )}
            {phase === "running" && route && (
              <motion.div key="running" {...fade}>
                <RouteTimeline
                  amount={activeAmount}
                  tab={tab}
                  route={route}
                  stepIdx={stepIdx}
                />
              </motion.div>
            )}
            {phase === "done" && route && (
              <motion.div key="done" {...fade}>
                <Receipt
                  amount={activeAmount}
                  tab={tab}
                  route={route}
                  detail={
                    tab === "receive"
                      ? `via ${activeMethod?.label ?? ""}`
                      : `to ${activeDest?.label ?? ""}`
                  }
                  onReset={reset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- */
function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-[13px] font-medium transition-colors",
        active ? "text-ink" : "text-ink-3 hover:text-ink",
      )}
    >
      {active && (
        <motion.span
          layoutId="tabPill"
          className="absolute inset-0 rounded-2xl bg-bg-soft"
          transition={{ duration: 0.35, ease }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

/* ---------------------------------------------------------- */
function ReceiveForm({
  amount,
  onAmount,
  methodId,
  onMethod,
  onSubmit,
}: {
  amount: number;
  onAmount: (n: number) => void;
  methodId: string;
  onMethod: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label>You're billing</Label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-rule bg-bg-soft/40 px-4 py-3 focus-within:border-ink">
          <span
            className="text-[20px] text-ink-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            $
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={1}
            value={amount}
            onChange={(e) => onAmount(Math.max(1, Number(e.target.value) || 0))}
            className="w-full bg-transparent text-[22px] font-medium text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{ fontFamily: "var(--font-display)" }}
          />
          <span
            className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            USD
          </span>
        </div>
      </div>

      <div>
        <Label>Customer pays with</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {RECEIVE_METHODS.map((m) => (
            <MethodButton
              key={m.id}
              method={m}
              selected={m.id === methodId}
              displayAmount={
                m.id === "ach"
                  ? formatUSD(amount)
                  : `${convertFromUSD(amount, m.rate).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${m.label}`
              }
              onClick={() => onMethod(m.id)}
            />
          ))}
        </div>
      </div>

      <SubmitRow
        label={`Take $${amount.toLocaleString("en-US")} payment`}
        onSubmit={onSubmit}
      />
    </div>
  );
}

/* ---------------------------------------------------------- */
function SendForm({
  amount,
  onAmount,
  recipient,
  onRecipient,
  destId,
  onDest,
  onSubmit,
}: {
  amount: number;
  onAmount: (n: number) => void;
  recipient: string;
  onRecipient: (s: string) => void;
  destId: string;
  onDest: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3">
          <Label>To</Label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => onRecipient(e.target.value)}
            placeholder="alex.useroutr or GA•••"
            className="mt-2 w-full rounded-2xl border border-rule bg-bg-soft/40 px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink-4 focus:border-ink"
          />
        </div>
        <div className="col-span-2">
          <Label>Amount</Label>
          <div className="mt-2 flex items-center gap-1.5 rounded-2xl border border-rule bg-bg-soft/40 px-3 py-3 focus-within:border-ink">
            <span
              className="text-[16px] text-ink-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={amount}
              onChange={(e) =>
                onAmount(Math.max(1, Number(e.target.value) || 0))
              }
              className="w-full bg-transparent text-[16px] font-medium text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ fontFamily: "var(--font-display)" }}
            />
          </div>
        </div>
      </div>

      <div>
        <Label>Deliver as</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SEND_DESTINATIONS.map((d) => (
            <DestButton
              key={d.id}
              dest={d}
              selected={d.id === destId}
              onClick={() => onDest(d.id)}
            />
          ))}
        </div>
      </div>

      <SubmitRow
        label={`Send $${amount.toLocaleString("en-US")}`}
        onSubmit={onSubmit}
      />
    </div>
  );
}

/* ---------------------------------------------------------- */
function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </span>
  );
}

function MethodButton({
  method,
  selected,
  displayAmount,
  onClick,
}: {
  method: ReceiveMethod;
  selected: boolean;
  displayAmount: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 rounded-2xl border bg-bg-card px-3 py-2.5 text-left transition-all",
        selected
          ? "border-ink shadow-[0_0_0_3px_rgba(14,15,18,0.05)]"
          : "border-rule hover:border-rule-2",
      )}
    >
      <BrandLogo id={method.brand} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">
          {method.label}
        </span>
        <span
          className="block truncate text-[11px] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {displayAmount}
        </span>
      </span>
    </button>
  );
}

function DestButton({
  dest,
  selected,
  onClick,
}: {
  dest: SendDestination;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 rounded-2xl border bg-bg-card px-3 py-2.5 text-left transition-all",
        selected
          ? "border-ink shadow-[0_0_0_3px_rgba(14,15,18,0.05)]"
          : "border-rule hover:border-rule-2",
      )}
    >
      <BrandLogo id={dest.brand} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">
          {dest.label}
        </span>
        <span
          className="block truncate text-[11px] text-ink-3"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {dest.sublabel}
        </span>
      </span>
    </button>
  );
}

function SubmitRow({
  label,
  onSubmit,
}: {
  label: string;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-rule pt-5">
      <span className="text-[12px] text-ink-3">
        Settles in ~8-20s · On-chain
      </span>
      <button type="button" onClick={onSubmit} className="magnet">
        <span className="pill pill-accent py-3 text-[13px]">
          {label}
          <ArrowRight className="size-4" strokeWidth={1.6} />
        </span>
      </button>
    </div>
  );
}

/* ---------------------------------------------------------- */
function RouteTimeline({
  amount,
  tab,
  route,
  stepIdx,
}: {
  amount: number;
  tab: Tab;
  route: RouteResult;
  stepIdx: number;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <Label>{tab === "receive" ? "Settling payment" : "Sending"}</Label>
        <div
          className="mt-2 text-[40px] font-medium leading-none text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatUSD(amount)}
        </div>
      </div>

      <div className="space-y-3">
        {route.steps.map((step, i) => {
          const status =
            i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
          return (
            <div
              key={step.id}
              className="flex items-center gap-3 rounded-2xl border border-rule bg-bg-soft/30 px-4 py-3"
            >
              <StepDot status={status} />
              <span
                className={cn(
                  "flex-1 text-[14px] transition-colors",
                  status === "pending" ? "text-ink-3" : "text-ink",
                )}
              >
                {step.label}
              </span>
              {status === "done" && (
                <span
                  className="text-[11px] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {(step.durationMs / 1000).toFixed(1)}s
                </span>
              )}
              {status === "active" && (
                <span
                  className="text-[11px] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  in flight
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepDot({ status }: { status: "pending" | "active" | "done" }) {
  if (status === "done") {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-[#e6f4ec] text-[#1f6c43]">
        <Check className="size-3.5" strokeWidth={2.2} />
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-ink text-bg">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className="grid size-7 place-items-center rounded-full border border-rule text-ink-4">
      <span className="size-1.5 rounded-full bg-current" />
    </span>
  );
}

/* ---------------------------------------------------------- */
function Receipt({
  amount,
  tab,
  route,
  detail,
  onReset,
}: {
  amount: number;
  tab: Tab;
  route: RouteResult;
  detail: string;
  onReset: () => void;
}) {
  const totalMs = route.steps.reduce((sum, s) => sum + s.durationMs, 0);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease }}
          className="mx-auto grid size-14 place-items-center rounded-full bg-[#e6f4ec] text-[#1f6c43]"
        >
          <Check className="size-6" strokeWidth={2.2} />
        </motion.div>
        <div className="mt-4">
          <Label>{tab === "receive" ? "Payment settled" : "Sent"} · {(totalMs / 1000).toFixed(1)}s</Label>
        </div>
        <div
          className="mt-1 text-[40px] font-medium leading-none text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatUSD(amount)}
        </div>
        <div className="mt-1 text-[13px] text-ink-3">{detail}</div>
      </div>

      <div className="space-y-2 rounded-2xl border border-rule bg-bg-soft/40 px-4 py-3">
        <Row label="Route" value={route.routeSummary} />
        <Row label="Network" value={route.network} />
        <Row label="Fee" value={route.fee} />
      </div>

      <div className="flex items-center justify-between border-t border-rule pt-5">
        <span className="text-[12px] text-ink-3">
          When live, this hits your real Useroutr account.
        </span>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-full border border-rule px-3 py-1.5 text-[12px] text-ink-2 transition hover:border-ink hover:text-ink"
        >
          <RotateCcw className="size-3.5" strokeWidth={1.6} />
          Try another
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[12px]">
      <span
        className="uppercase tracking-[0.14em] text-ink-3"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </span>
      <span
        className="text-right text-ink"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {value}
      </span>
    </div>
  );
}
