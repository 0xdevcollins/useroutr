"use client";

import { BrandStatusBadge, type Tone } from "@/components/brand/StatusBadge";
import { type PaymentStatus } from "@/hooks/usePayments";

interface StatusBadgeProps {
  status: PaymentStatus;
}

const STATUS_TONES: Record<PaymentStatus, Tone> = {
  PENDING: "pending",
  QUOTE_LOCKED: "processing",
  SOURCE_LOCKED: "processing",
  STELLAR_LOCKED: "processing",
  PROCESSING: "processing",
  COMPLETED: "completed",
  REFUNDING: "processing",
  REFUNDED: "cancelled",
  EXPIRED: "failed",
  FAILED: "failed",
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  QUOTE_LOCKED: "Quote locked",
  SOURCE_LOCKED: "Source locked",
  STELLAR_LOCKED: "Stellar locked",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  REFUNDING: "Refunding",
  REFUNDED: "Refunded",
  EXPIRED: "Expired",
  FAILED: "Failed",
};

const PULSING: Set<PaymentStatus> = new Set<PaymentStatus>([
  "PROCESSING",
  "QUOTE_LOCKED",
  "SOURCE_LOCKED",
  "STELLAR_LOCKED",
  "REFUNDING",
]);

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <BrandStatusBadge tone={STATUS_TONES[status]} pulse={PULSING.has(status)}>
      {STATUS_LABELS[status]}
    </BrandStatusBadge>
  );
}
