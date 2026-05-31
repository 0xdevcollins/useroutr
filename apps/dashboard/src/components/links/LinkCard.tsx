"use client";

import { cn } from "@/lib/utils";
import {
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@useroutr/ui";
import { QrCode, Trash } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { LinkStatusBadge } from "./LinkStatusBadge";
import { CopyButton } from "./CopyButton";
import type { PaymentLink } from "@useroutr/types";

interface LinkCardProps {
  link: PaymentLink;
  onQRCode: (link: PaymentLink) => void;
  onDeactivate: (link: PaymentLink) => void;
}

/**
 * Editorial payment-link card. Replaces the shadcn Card chrome with the
 * site's `surface` pattern — hairline-divided rows, mono ID label, big
 * display amount, status badge top-right.
 */
export function LinkCard({ link, onQRCode, onDeactivate }: LinkCardProps) {
  const isExpired = link.status === "expired";
  const isDeactivated = link.status === "deactivated";
  const canDeactivate = !isExpired && !isDeactivated;

  const expiryLabel = link.expiresAt
    ? new Date(link.expiresAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : undefined;

  const isSingleUse = link.type === "single-use";

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(14,15,18,0.18)]",
        (isExpired || isDeactivated) && "opacity-70",
      )}
    >
      {/* Header — mono ID + status */}
      <div className="flex items-center justify-between gap-2 border-b border-rule px-5 py-3">
        <span
          className="truncate text-[11px] text-text-faint"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {link.id}
        </span>
        <LinkStatusBadge status={link.status} />
      </div>

      {/* Amount block */}
      <div className="px-5 pb-2 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className="text-[28px] leading-none tracking-[-0.025em] text-foreground tabular"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {link.amount
              ? formatCurrency(link.amount, link.currency)
              : "Open amount"}
          </span>
          <span
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-text-faint"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {isSingleUse ? "Single-use" : "Multi-use"}
          </span>
        </div>
        {link.description && (
          <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">
            {link.description}
          </p>
        )}
      </div>

      {/* Meta row — Used × · Expires */}
      <dl
        className="grid grid-cols-2 gap-px border-y border-rule bg-rule"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <div className="flex flex-col gap-0.5 bg-card px-5 py-3">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
            Used
          </dt>
          <dd className="text-[13px] text-foreground">
            {link.usageCount}× times
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 bg-card px-5 py-3">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
            Expires
          </dt>
          <dd className="text-[13px] text-foreground">
            {expiryLabel ?? "Never"}
          </dd>
        </div>
      </dl>

      {/* Footer — actions */}
      <div className="flex items-center gap-2 px-5 py-3">
        <TooltipProvider>
          <CopyButton
            value={link.url}
            feedbackText="Copied"
            className="flex-1"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onQRCode(link)}
                className="flex-1"
              >
                <QrCode size={14} />
                QR
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate a QR code for this link</TooltipContent>
          </Tooltip>
          {canDeactivate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDeactivate(link)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Deactivate this link</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </motion.article>
  );
}
