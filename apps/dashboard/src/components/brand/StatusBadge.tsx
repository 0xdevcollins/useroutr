import { type ReactNode } from "react";

export type Tone =
  | "neutral"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "warning";

interface Props {
  tone: Tone;
  children: ReactNode;
  className?: string;
  /** When true, the leading dot pulses softly — used for live "Processing" states */
  pulse?: boolean;
}

/**
 * Editorial status badge — soft-tinted pill with a colored leading dot,
 * mono uppercase label. Replaces the shadcn `Badge` usages across
 * Payments, Payouts, Links, and Invoices so every list reads with the
 * same vocabulary.
 */
export function BrandStatusBadge({ tone, children, className, pulse }: Props) {
  const t = TONES[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${t.bg} ${t.text} ${className ?? ""}`}
      style={{
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.04em",
      }}
    >
      <span className={`relative grid size-1.5 place-items-center`}>
        {pulse && (
          <span
            className={`absolute size-1.5 rounded-full ${t.dot} pulse-soft`}
          />
        )}
        <span className={`size-1.5 rounded-full ${t.dot}`} />
      </span>
      <span className="uppercase">{children}</span>
    </span>
  );
}

const TONES: Record<Tone, { bg: string; text: string; dot: string }> = {
  neutral: {
    bg: "bg-secondary",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  pending: {
    bg: "bg-warning/10",
    text: "text-warning",
    dot: "bg-warning",
  },
  processing: {
    bg: "bg-accent/10",
    text: "text-accent",
    dot: "bg-accent",
  },
  completed: {
    bg: "bg-success/10",
    text: "text-success",
    dot: "bg-success",
  },
  failed: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
  },
  cancelled: {
    bg: "bg-secondary",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  warning: {
    bg: "bg-warning/10",
    text: "text-warning",
    dot: "bg-warning",
  },
};
