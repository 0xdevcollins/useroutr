import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  CreatePaymentLinkInput,
  PaymentLink,
  PaymentLinkStats,
} from "@useroutr/types";

export interface LinksParams {
  page?: number;
  limit?: number;
  status?: "active" | "expired" | "deactivated" | "all";
}

export interface LinksMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LinksResponse {
  data: PaymentLink[];
  meta: LinksMeta;
}

type LinksQueryKey = ["links", LinksParams?];

function updateLinkCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (old: LinksResponse, params: LinksParams) => LinksResponse,
) {
  const caches = queryClient.getQueriesData<LinksResponse>({
    queryKey: ["links"],
  });

  for (const [key, value] of caches) {
    if (!value) continue;
    const params = ((key as LinksQueryKey)[1] ?? {}) as LinksParams;
    queryClient.setQueryData<LinksResponse>(key, updater(value, params));
  }
}

function canInsertIntoQuery(params: LinksParams, link: PaymentLink): boolean {
  const status = params.status ?? "all";
  return status === "all" || status === link.status;
}

export function useLinks(params: LinksParams = {}) {
  return useQuery<LinksResponse>({
    queryKey: ["links", params],
    queryFn: () =>
      api.get("/payment-links", {
        params: params as Record<string, unknown>,
      }),
  });
}

export function useCreateLink() {
  const queryClient = useQueryClient();

  return useMutation<PaymentLink, Error, CreatePaymentLinkInput>({
    mutationFn: (body) => api.post<PaymentLink>("/payment-links", body),
    onSuccess: (newLink) => {
      updateLinkCaches(queryClient, (old, params) => {
        if (!canInsertIntoQuery(params, newLink)) {
          return old;
        }

        const page = params.page ?? 1;
        const isFirstPage = page <= 1;
        if (!isFirstPage) {
          return {
            ...old,
            meta: {
              ...old.meta,
              total: old.meta.total + 1,
              totalPages: Math.ceil((old.meta.total + 1) / old.meta.limit),
            },
          };
        }

        const exists = old.data.some((item) => item.id === newLink.id);
        if (exists) {
          return old;
        }

        const nextData = [newLink, ...old.data].slice(0, old.meta.limit);
        const nextTotal = old.meta.total + 1;

        return {
          data: nextData,
          meta: {
            ...old.meta,
            total: nextTotal,
            totalPages: Math.ceil(nextTotal / old.meta.limit),
          },
        };
      });
    },
  });
}

export function useDeactivateLink() {
  const queryClient = useQueryClient();

  return useMutation<PaymentLink, Error, string>({
    mutationFn: (id) => api.delete<PaymentLink>(`/payment-links/${id}`),
    onSuccess: (updatedLink) => {
      updateLinkCaches(queryClient, (old, params) => {
        const status = params.status ?? "all";

        let nextData = old.data.map((item) =>
          item.id === updatedLink.id ? updatedLink : item,
        );

        if (status !== "all") {
          nextData = nextData.filter((item) => item.status === status);
        }

        return {
          ...old,
          data: nextData,
        };
      });

      queryClient.setQueryData<PaymentLink>(["link", updatedLink.id], updatedLink);
    },
  });
}

export function useLink(id: string) {
  return useQuery<PaymentLink>({
    queryKey: ["link", id],
    queryFn: () => api.get(`/payment-links/${id}`),
    enabled: !!id,
  });
}

export function useLinkStats(id: string) {
  return useQuery<PaymentLinkStats>({
    queryKey: ["link-stats", id],
    queryFn: () => api.get(`/payment-links/${id}/stats`),
    enabled: !!id,
  });
}
