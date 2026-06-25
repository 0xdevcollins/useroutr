"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Link as LinkIcon,
  Send,
  Receipt,
  ArrowUpRight,
  ArrowRight,
} from "lucide-react";

interface Action {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  external?: boolean;
}

const ACTIONS: Action[] = [
  {
    icon: <LinkIcon className="size-4" strokeWidth={1.5} />,
    label: "New payment link",
    description: "Shareable URL with a fixed or open amount",
    href: "/links",
  },
  {
    icon: <Send className="size-4" strokeWidth={1.5} />,
    label: "Send a payout",
    description: "Single or bulk to bank, mobile, or wallet",
    href: "/payouts",
  },
  {
    icon: <Receipt className="size-4" strokeWidth={1.5} />,
    label: "Draft an invoice",
    description: "Branded, with auto-reminders",
    href: "/invoices",
  },
  {
    icon: <ArrowUpRight className="size-4" strokeWidth={1.5} />,
    label: "Read the API",
    description: "Docs · SDK · webhooks",
    href: "https://docs.useroutr.com",
    external: true,
  },
];

export function QuickActions() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="surface flex h-full flex-col p-6"
    >
      <span className="eyebrow">Quick actions</span>
      <h3
        className="mt-3 text-[20px] tracking-[-0.025em] text-foreground"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
      >
        What do you want to ship today?
      </h3>

      <ul className="mt-5 flex flex-1 flex-col">
        {ACTIONS.map((action, i) => (
          <motion.li
            key={action.href}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.4 + i * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="row-rule"
          >
            <Link
              href={action.href}
              {...(action.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              className="group flex items-center gap-4 py-4"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-card text-foreground transition-colors group-hover:border-accent group-hover:text-accent">
                {action.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-foreground transition-colors group-hover:text-accent">
                  {action.label}
                </span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {action.description}
                </span>
              </span>
              {action.external ? (
                <ArrowUpRight
                  className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
                  strokeWidth={1.5}
                />
              ) : (
                <ArrowRight
                  className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
                  strokeWidth={1.5}
                />
              )}
            </Link>
          </motion.li>
        ))}
      </ul>
    </motion.aside>
  );
}
