"use client";

import { BrandStatusBadge, type Tone } from "@/components/brand/StatusBadge";
import { type PayoutStatus } from "@/hooks/usePayouts";

interface PayoutStatusBadgeProps {
  status: PayoutStatus;
}

const STATUS_TONES: Record<PayoutStatus, Tone> = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

const STATUS_LABELS: Record<PayoutStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function PayoutStatusBadge({ status }: PayoutStatusBadgeProps) {
  return (
    <BrandStatusBadge
      tone={STATUS_TONES[status]}
      pulse={status === "PROCESSING"}
    >
      {STATUS_LABELS[status]}
    </BrandStatusBadge>
  );
}
