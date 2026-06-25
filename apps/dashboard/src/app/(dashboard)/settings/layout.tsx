"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Settings,
  KeyRound,
  Webhook,
  Users,
  Paintbrush,
} from "lucide-react";

const tabs = [
  { name: "General", href: "/settings", icon: Settings, n: "01" },
  { name: "API keys", href: "/settings/api-keys", icon: KeyRound, n: "02" },
  { name: "Webhooks", href: "/settings/webhooks", icon: Webhook, n: "03" },
  { name: "Team", href: "/settings/team", icon: Users, n: "04" },
  { name: "Branding", href: "/settings/branding", icon: Paintbrush, n: "05" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-8 dashboard-enter">
      {/* Editorial header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-rule pb-6"
      >
        <span className="eyebrow">Settings</span>
        <h1
          className="mt-3 text-[32px] leading-[1.05] tracking-[-0.035em] text-foreground md:text-[40px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          Account,{" "}
          <span className="editorial-italic text-muted-foreground">
            tuned to your stack.
          </span>
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground md:text-[15px]">
          Manage API keys, webhooks, team access, and your brand. Changes here
          ripple through hosted checkout, invoices, and payouts.
        </p>
      </motion.header>

      <div className="flex flex-col gap-10 lg:flex-row">
        {/* Sidebar — editorial: numbered, hairline rows */}
        <nav className="w-full shrink-0 lg:w-60">
          <ul className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {tabs.map((tab) => {
              const isActive =
                tab.href === "/settings"
                  ? pathname === "/settings"
                  : pathname.startsWith(tab.href);

              const Icon = tab.icon;

              return (
                <li key={tab.name}>
                  <Link
                    href={tab.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors",
                      isActive
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "shrink-0 text-[11px]",
                        isActive ? "text-accent" : "text-text-faint",
                      )}
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {tab.n}
                    </span>
                    <Icon
                      size={16}
                      strokeWidth={1.5}
                      className="shrink-0"
                    />
                    <span className="whitespace-nowrap">{tab.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content area */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
