"use client";

import { CreditCard, Bank, CurrencyBtc } from "@phosphor-icons/react";
import { cn } from "@tavvio/ui";
import Link from "next/link";

const METHODS = [
  {
    id: "card",
    label: "Card",
    description: "Visa, Mastercard, etc.",
    icon: CreditCard,
  },
  {
    id: "bank",
    label: "Bank Transfer",
    description: "Direct bank payment",
    icon: Bank,
  },
  {
    id: "crypto",
    label: "Crypto",
    description: "USDC, ETH, BTC",
    icon: CurrencyBtc,
  },
] as const;

export function PaymentMethodSelector({ paymentId }: { paymentId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-base font-semibold text-foreground">
        Payment method
      </h2>

      <div className="mt-4 space-y-2">
        {METHODS.map((method) => {
          const Icon = method.icon;
          return (
            <Link
              key={method.id}
              href={`/${paymentId}/${method.id}`}
              className={cn(
                "flex w-full items-center gap-4 rounded-lg border border-border px-4 py-3.5 text-left transition-colors",
                "hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon size={22} className="text-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {method.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {method.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
