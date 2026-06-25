"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/useCountUp";

export function BalanceWidgetSkeleton() {
  return (
    <div className="surface flex flex-col gap-3 p-6">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

interface BalanceWidgetProps {
  amount: number;
  asset: string;
  index?: number;
  /** Percent of cap used — drives the bar gauge. Defaults to 47 */
  pct?: number;
}

export function BalanceWidget({
  amount,
  asset,
  index = 3,
  pct = 47,
}: BalanceWidgetProps) {
  const animated = useCountUp(amount, 600);
  const totalBars = 24;
  const filled = Math.round((pct / 100) * totalBars);

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.06,
      }}
      className="surface relative flex flex-col gap-3 overflow-hidden p-6"
    >
      {/* Decorative accent rail */}
      <span
        aria-hidden
        className="absolute left-0 top-0 h-full w-[2px] bg-accent"
      />

      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Settlement balance</span>
        <span
          className="text-[11px] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {asset} · Stellar
        </span>
      </div>

      <div
        className="text-[36px] leading-none tracking-[-0.035em] text-foreground tabular md:text-[40px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
      >
        ${animated.toLocaleString()}
      </div>

      {/* Bar gauge — same vocabulary as the marketing hero balance card */}
      <div className="mt-1 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-[3px]">
          {Array.from({ length: totalBars }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.022 }}
              className={`h-3 w-0.5 origin-bottom rounded-full ${
                i < filled ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
        <span
          className="shrink-0 text-[11px] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {pct}%
        </span>
      </div>
    </motion.article>
  );
}
