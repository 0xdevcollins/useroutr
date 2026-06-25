"use client";

import { BrandStatusBadge, type Tone } from "@/components/brand/StatusBadge";
import type { LinkStatus } from "@useroutr/types";

const STATUS_TONES: Record<LinkStatus, Tone> = {
  active: "completed",
  expired: "failed",
  deactivated: "cancelled",
};

const STATUS_LABELS: Record<LinkStatus, string> = {
  active: "Active",
  expired: "Expired",
  deactivated: "Deactivated",
};

interface LinkStatusBadgeProps {
  status: LinkStatus;
  className?: string;
}

export function LinkStatusBadge({ status, className }: LinkStatusBadgeProps) {
  return (
    <BrandStatusBadge tone={STATUS_TONES[status]} className={className}>
      {STATUS_LABELS[status]}
    </BrandStatusBadge>
  );
}
