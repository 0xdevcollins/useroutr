"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast, type ToastVariant } from "@useroutr/ui";
import { useDashboardSocket } from "@/hooks/useDashboardSocket";
import { useToastNotificationPreference } from "@/hooks/useToastNotificationPreference";

type RealtimeEventName =
  | "payment.received"
  | "payment.failed"
  | "payment_link.paid"
  | "invoice.paid"
  | "payout.completed"
  | "payout.failed"
  | "webhook.failed"
  | "bulk_payout.completed";

interface ToastPayload {
  type: ToastVariant;
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

interface SocketEnvelope {
  event?: string;
  data?: Record<string, unknown>;
}

function getString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function formatAmount(amount?: unknown, currency?: unknown): string {
  const numericAmount =
    typeof amount === "number"
      ? amount
      : typeof amount === "string"
        ? Number(amount)
        : Number.NaN;

  const currencyCode =
    typeof currency === "string" && currency.trim().length >= 3
      ? currency.trim().slice(0, 3).toUpperCase()
      : "USD";

  if (!Number.isFinite(numericAmount)) {
    return typeof amount === "string" && amount.trim()
      ? amount.trim()
      : "an amount";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(numericAmount);
  } catch {
    return `${numericAmount.toLocaleString()} ${currencyCode}`;
  }
}

function getDomainLabel(value?: string): string {
  if (!value) {
    return "your webhook endpoint";
  }

  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function resolveEvent(
  eventName: string,
  payload: Record<string, unknown>,
): { name: RealtimeEventName; payload: Record<string, unknown> } | null {
  if (
    [
      "payment.received",
      "payment.failed",
      "payment_link.paid",
      "invoice.paid",
      "payout.completed",
      "payout.failed",
      "webhook.failed",
      "bulk_payout.completed",
    ].includes(eventName)
  ) {
    return {
      name: eventName as RealtimeEventName,
      payload,
    };
  }

  if (eventName === "payment-link.payment") {
    return {
      name: "payment_link.paid",
      payload,
    };
  }

  if (eventName === "payment:status") {
    const status = String(payload.status ?? "").toLowerCase();

    if (["completed", "paid", "success", "succeeded"].includes(status)) {
      return { name: "payment.received", payload };
    }

    if (["failed", "error", "declined"].includes(status)) {
      return { name: "payment.failed", payload };
    }
  }

  if (eventName === "payout:status") {
    const status = String(payload.status ?? "").toLowerCase();

    if (["completed", "paid", "success", "succeeded"].includes(status)) {
      return { name: "payout.completed", payload };
    }

    if (status.includes("bulk") && status.includes("complete")) {
      return { name: "bulk_payout.completed", payload };
    }

    if (["failed", "error", "rejected"].includes(status)) {
      return { name: "payout.failed", payload };
    }
  }

  if (eventName === "webhook:delivery") {
    const status = String(payload.status ?? "").toLowerCase();

    if (["failed", "error"].includes(status)) {
      return { name: "webhook.failed", payload };
    }
  }

  if (eventName === "notification") {
    const type = String(payload.type ?? "").toLowerCase();

    if (type === "link_paid") {
      return { name: "payment_link.paid", payload };
    }

    if (type === "invoice_paid") {
      return { name: "invoice.paid", payload };
    }

    if (type === "bulk_payout_completed") {
      return { name: "bulk_payout.completed", payload };
    }
  }

  return null;
}

function buildToastPayload(
  eventName: RealtimeEventName,
  payload: Record<string, unknown>,
): ToastPayload {
  switch (eventName) {
    case "payment.received": {
      const payer = getString(
        payload.customerEmail,
        payload.email,
        payload.customerName,
        payload.name,
      );
      const amount = formatAmount(
        payload.amount ?? payload.destAmount ?? payload.sourceAmount,
        payload.currency ?? payload.destAsset ?? payload.sourceAsset,
      );
      const paymentId = getString(payload.paymentId, payload.id);

      return {
        type: "success",
        title: "Payment received",
        message: `Payment received — ${amount}${payer ? ` from ${payer}` : ""}`,
        actionLabel: paymentId ? "View Payment →" : undefined,
        actionHref: paymentId ? `/payments/${paymentId}` : undefined,
      };
    }

    case "payment.failed": {
      const paymentId = getString(payload.paymentId, payload.id);

      return {
        type: "error",
        title: "Payment failed",
        message: "A payment attempt failed and may need review.",
        actionLabel: paymentId ? "Review Payment →" : undefined,
        actionHref: paymentId ? `/payments/${paymentId}` : "/payments",
      };
    }

    case "payment_link.paid": {
      const linkName = getString(
        payload.title,
        payload.name,
        payload.linkTitle,
      );

      return {
        type: "success",
        title: "Payment link paid",
        message: `Payment link '${linkName ?? "Untitled link"}' was just paid`,
        actionLabel: "View Links →",
        actionHref: "/links",
      };
    }

    case "invoice.paid": {
      const invoiceLabel = getString(
        payload.invoiceNumber,
        payload.invoiceId,
        payload.resourceId,
      );

      return {
        type: "success",
        title: "Invoice paid",
        message: `Invoice ${invoiceLabel ? `#${invoiceLabel}` : ""} marked as paid`.trim(),
        actionLabel: "View Invoices →",
        actionHref: "/invoices",
      };
    }

    case "payout.completed": {
      const recipient = getString(
        payload.recipientName,
        payload.name,
        payload.beneficiary,
      );

      return {
        type: "success",
        title: "Payout completed",
        message: `Payout${recipient ? ` to ${recipient}` : ""} completed`,
        actionLabel: "View Payouts →",
        actionHref: "/payouts",
      };
    }

    case "payout.failed": {
      return {
        type: "error",
        title: "Payout failed",
        message: "A payout could not be completed.",
        actionLabel: "View Payouts →",
        actionHref: "/payouts",
      };
    }

    case "webhook.failed": {
      const endpoint = getDomainLabel(
        getString(payload.endpointUrl, payload.webhookUrl, payload.url),
      );

      return {
        type: "error",
        title: "Webhook failed",
        message: `Webhook delivery to ${endpoint} failed`,
        actionLabel: "Retry Webhook →",
        actionHref: "/settings/webhooks",
      };
    }

    case "bulk_payout.completed": {
      const successCount = payload.successCount ?? payload.successful ?? 0;
      const totalCount = payload.totalCount ?? payload.total ?? successCount;

      return {
        type: "info",
        title: "Bulk payout complete",
        message: `Bulk payout batch completed: ${successCount}/${totalCount} successful`,
        actionLabel: "View Payouts →",
        actionHref: "/payouts",
      };
    }
  }
}

function invalidateForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  eventName: RealtimeEventName,
  payload: Record<string, unknown>,
) {
  switch (eventName) {
    case "payment.received":
    case "payment.failed": {
      void queryClient.invalidateQueries({ queryKey: ["payments"] });

      const paymentId = getString(payload.paymentId, payload.id);
      if (paymentId) {
        void queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
      }
      break;
    }

    case "payment_link.paid":
      void queryClient.invalidateQueries({ queryKey: ["payment-links"] });
      break;

    case "invoice.paid":
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      break;

    case "payout.completed":
    case "payout.failed":
    case "bulk_payout.completed":
      void queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
      break;

    case "webhook.failed":
      void queryClient.invalidateQueries({ queryKey: ["webhook-logs"] });
      break;
  }
}

export function RealtimeToastNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { connected, subscribe } = useDashboardSocket();
  const { enabled } = useToastNotificationPreference();

  useEffect(() => {
    if (!connected) {
      return;
    }

    const showRealtimeToast = (
      rawEventName: string,
      rawPayload: Record<string, unknown>,
    ) => {
      const resolved = resolveEvent(rawEventName, rawPayload);
      if (!resolved) {
        return;
      }

      invalidateForEvent(queryClient, resolved.name, resolved.payload);

      if (!enabled) {
        return;
      }

      const mapped = buildToastPayload(resolved.name, resolved.payload);
      const onAction = mapped.actionHref
        ? () => router.push(mapped.actionHref!)
        : undefined;

      toast[mapped.type]({
        title: mapped.title,
        message: mapped.message,
        actionLabel: mapped.actionLabel,
        actionHref: mapped.actionHref,
        onAction,
      });
    };

    const unsubscribers = [
      subscribe("message", (raw) => {
        const envelope = raw as SocketEnvelope;

        if (!envelope?.event || !envelope.data) {
          return;
        }

        showRealtimeToast(envelope.event, envelope.data);
      }),
      subscribe("payment.received", (raw) =>
        showRealtimeToast("payment.received", raw as Record<string, unknown>),
      ),
      subscribe("payment_link.paid", (raw) =>
        showRealtimeToast("payment_link.paid", raw as Record<string, unknown>),
      ),
      subscribe("invoice.paid", (raw) =>
        showRealtimeToast("invoice.paid", raw as Record<string, unknown>),
      ),
      subscribe("payout.completed", (raw) =>
        showRealtimeToast("payout.completed", raw as Record<string, unknown>),
      ),
      subscribe("webhook.failed", (raw) =>
        showRealtimeToast("webhook.failed", raw as Record<string, unknown>),
      ),
      subscribe("bulk_payout.completed", (raw) =>
        showRealtimeToast(
          "bulk_payout.completed",
          raw as Record<string, unknown>,
        ),
      ),
      subscribe("payment-link.payment", (raw) =>
        showRealtimeToast("payment-link.payment", raw as Record<string, unknown>),
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [connected, enabled, queryClient, router, subscribe, toast]);

  return null;
}
