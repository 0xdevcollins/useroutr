import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaymentLink,
  PaymentLinkStats,
  CreatePaymentLinkInput,
  PaymentLinksResponse,
} from "@useroutr/types";

interface PaymentLinksParams {
  page?: number;
  limit?: number;
  /** "all" is normalised away server-side, so it is safe to pass through. */
  status?: string;
}

export function usePaymentLinks(params: PaymentLinksParams = {}) {
  return useQuery<PaymentLinksResponse>({
    queryKey: ["payment-links", params],
    // `/payment-links` answers with `{ data, meta }`. The api client only
    // unwraps the envelope when there is no `meta`, so both halves arrive here
    // intact — which is what pagination needs.
    queryFn: () =>
      api.get<PaymentLinksResponse>("/payment-links", {
        params: params as Record<string, unknown>,
      }),
    // Keeps the previous page on screen while the next one loads, instead of
    // collapsing the list to a skeleton on every page change.
    placeholderData: (previous) => previous,
  });
}

export function useCreatePaymentLink() {
  const queryClient = useQueryClient();

  return useMutation<PaymentLink, Error, CreatePaymentLinkInput>({
    mutationFn: (body) => api.post<PaymentLink>("/payment-links", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
}

export function useDeactivatePaymentLink() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/payment-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
}

export function usePaymentLinkStats(id: string) {
  return useQuery<PaymentLinkStats>({
    queryKey: ["payment-link-stats", id],
    queryFn: () => api.get(`/payment-links/${id}/stats`),
    enabled: !!id,
  });
}
