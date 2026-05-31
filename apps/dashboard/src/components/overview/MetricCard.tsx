"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/useCountUp";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function MetricCardSkeleton() {
  return (
    <div className="surface flex flex-col gap-3 p-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// ── Sparkline tooltip ───────────────────────────────────────────────────────

function SparkTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md bg-foreground px-2 py-1 text-[11px] text-background shadow"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {payload[0].value.toLocaleString()}
    </div>
  );
}

// ── MetricCard ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  delta?: number;
  sparkline?: number[];
  prefix?: string;
  suffix?: string;
  /** Skip currency-style formatting (e.g. for raw counts) */
  plain?: boolean;
  index?: number;
}

export function MetricCard({
  label,
  value,
  delta,
  sparkline,
  prefix = "$",
  suffix,
  plain = false,
  index = 0,
}: MetricCardProps) {
  const animated = useCountUp(value, 600);
  const isPositive = delta === undefined || delta >= 0;
  const sparkData = (sparkline ?? []).map((v, i) => ({ i, v }));

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.06,
      }}
      className="surface flex flex-col gap-3 p-6"
    >
      {/* Mono eyebrow label */}
      <span className="eyebrow">{label}</span>

      {/* Display numerals — same family as the marketing hero */}
      <div
        className="text-[36px] leading-none tracking-[-0.035em] text-foreground tabular md:text-[40px]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
      >
        {!plain && prefix}
        {animated.toLocaleString()}
        {suffix && (
          <span className="ml-1 text-[16px] font-medium text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>

      {/* Delta pill */}
      {delta !== undefined && (
        <div
          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isPositive
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {isPositive ? (
            <TrendingUp className="size-3" strokeWidth={1.8} />
          ) : (
            <TrendingDown className="size-3" strokeWidth={1.8} />
          )}
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {isPositive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">vs prior period</span>
        </div>
      )}

      {/* Sparkline */}
      {sparkData.length > 0 && (
        <div className="mt-1 h-10 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sparkData}
              margin={{ top: 2, right: 0, bottom: 2, left: 0 }}
            >
              <Tooltip content={<SparkTooltip />} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={
                  isPositive
                    ? "var(--accent)"
                    : "var(--destructive)"
                }
                strokeWidth={1.6}
                dot={false}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.article>
  );
}
