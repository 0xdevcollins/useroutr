"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DestType } from "@useroutr/types";

interface FeeEstimatorProps {
  amount: string;
  currency: string;
  destinationType: DestType;
  onEstimate: (estimate: {
    fee: string;
    total: string;
    conversionRate?: string;
  } | null) => void;
}

interface FeeResponse {
  amount: string;
  currency: string;
  fee: string;
  total: string;
  conversionRate?: string;
  feePercentage: number;
}

export function FeeEstimator({
  amount,
  currency,
  destinationType,
  onEstimate,
}: FeeEstimatorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      onEstimate(null);
      return;
    }

    const fetchFeeEstimate = async () => {
      setLoading(true);
      setError(null);

      try {
        // Call fee estimation endpoint
        // This would typically be /v1/quotes or similar
        const response = await fetch(
          `/api/v1/quotes/estimate-fee?amount=${amount}&currency=${currency}&destinationType=${destinationType}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to estimate fee");
        }

        const data: FeeResponse = await response.json();

        onEstimate({
          fee: data.fee,
          total: data.total,
          conversionRate: data.conversionRate,
        });
      } catch (err) {
        console.error("Fee estimation error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to estimate fee"
        );
        // Provide fallback estimate
        const fallbackFee = (parseFloat(amount) * 0.005).toFixed(2); // 0.5% default
        const fallbackTotal = (parseFloat(amount) + parseFloat(fallbackFee)).toFixed(2);
        onEstimate({
          fee: `${fallbackFee} ${currency}`,
          total: `${fallbackTotal} ${currency}`,
        });
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchFeeEstimate, 500);
    return () => clearTimeout(debounceTimer);
  }, [amount, currency, destinationType, onEstimate]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Calculating fees...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-amber-600">
        Using estimated fees (live rates unavailable)
      </div>
    );
  }

  return null;
}
