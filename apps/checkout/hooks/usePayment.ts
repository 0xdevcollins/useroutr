import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { api } from "@/lib/api";

export type PaymentMethod = "card" | "bank" | "crypto";

interface PaymentMerchant {
  name?: string;
  logo?: string;
}

interface PaymentMetadata {
  description?: string;
  orderId?: string;
  redirect_url?: string;
  return_url?: string;
  receipt_email?: string;
  [key: string]: unknown;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  merchantName: string;
  merchantLogo?: string;
  description?: string;
  lineItems?: { label: string; amount: number }[];
  expiresAt?: string;
  paymentMethods?: PaymentMethod[];
  merchant?: PaymentMerchant;
  metadata?: PaymentMetadata;
}

export function usePayment(paymentId: string) {
  const startedAtRef = useRef<number>(Date.now());

  return useQuery<Payment>({
    queryKey: ["payment", paymentId],
    queryFn: () => api.get(`/checkout/${paymentId}`),
    enabled: !!paymentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toUpperCase();
      if (status !== "AWAITING_CONFIRMATION") {
        return false;
      }

      const elapsed = Date.now() - startedAtRef.current;
      return elapsed > 60_000 ? 12_000 : 5_000;
    },
  });
}
