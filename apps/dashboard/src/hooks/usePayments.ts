import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Payment {
  id: string;
  amount: string | number;
  currency: string;
  status: PaymentStatus;
  sourceChain: string;
  sourceAsset: string;
  sourceAmount: string | number;
  destChain: string;
  destAsset: string;
  destAmount: string | number;
  destAddress: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  refundedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  // For display
  customerEmail?: string;
  sourceAddress?: string;
}

export type PaymentStatus = 
  | "PENDING"
  | "QUOTE_LOCKED"
  | "SOURCE_LOCKED"
  | "STELLAR_LOCKED"
  | "PROCESSING"
  | "COMPLETED"
  | "REFUNDING"
  | "REFUNDED"
  | "EXPIRED"
  | "FAILED";

interface PaymentsResponse {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentsParams extends Record<string, unknown> {
  page?: number;
  limit?: number;
  status?: PaymentStatus | string;
  search?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  sourceChain?: string;
  destChain?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function usePayments(params: PaymentsParams = {}) {
  return useQuery<PaymentsResponse>({
    queryKey: ["payments", params],
    queryFn: () => api.get("/payments", { params }),
  });
}

export function usePayment(id: string) {
  return useQuery<Payment>({
    queryKey: ["payment", id],
    queryFn: () => api.get(`/payments/${id}`),
    enabled: !!id,
  });
}