import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Quote {
  id: string;
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  rate: number;
  fee: number;
  expiresAt: string;
}

export function useQuote(paymentId: string, token?: string) {
  return useQuery<Quote>({
    queryKey: ["quote", paymentId, token],
    queryFn: () => api.get(`/checkout/${paymentId}/quote`, { params: { token } }),
    enabled: !!paymentId && !!token,
    refetchInterval: 25000, // Refresh before 30s expiry
  });
}
