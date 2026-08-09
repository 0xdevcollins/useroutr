"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Period = "7d" | "30d" | "90d" | "1y";

export type TransactionStatus =
  | "COMPLETED"
  | "PENDING"
  | "PROCESSING"
  | "FAILED"
  | "CANCELLED";

export interface MetricSeries {
  total: number;
  delta: number; // percentage change vs previous period
  sparkline: number[];
}

export interface AnalyticsOverview {
  revenue: MetricSeries;
  payments: MetricSeries;
  payouts: { total: number; delta: number };
  balance: { amount: number; asset: string };
  revenueChart: { date: string; amount: number }[];
  recentTransactions: {
    id: string;
    customer: string;
    amount: number;
    currency: string;
    status: TransactionStatus;
    createdAt: string;
  }[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const [period, setPeriod] = useState<Period>("30d");

  const query = useQuery<AnalyticsOverview>({
    queryKey: ["analytics-overview", period],
    queryFn: () =>
      api.get<AnalyticsOverview>("/analytics/overview", {
        params: { period },
      }),
    staleTime: 60_000, // re-fetch after 1 min
    retry: 2,
  });

  return { ...query, period, setPeriod };
}
