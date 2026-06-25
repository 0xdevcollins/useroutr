"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

interface GreetingHeaderProps {
  merchantName?: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function GreetingHeader({
  merchantName = "Merchant",
}: GreetingHeaderProps) {
  const greeting = useMemo(() => getGreeting(), []);
  const today = useMemo(() => formatToday(), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-1 border-b border-rule pb-6 md:flex-row md:items-end md:justify-between"
    >
      <div>
        <span
          className="eyebrow"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {today}
        </span>
        <h1
          className="mt-3 text-[36px] leading-[1.05] tracking-[-0.035em] text-foreground md:text-[44px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {greeting},{" "}
          <span className="editorial-italic text-muted-foreground">
            {merchantName}.
          </span>
        </h1>
      </div>

      <div
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[12px] text-foreground"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span className="relative grid size-2 place-items-center">
          <span className="absolute size-2 rounded-full bg-success pulse-soft" />
          <span className="size-1.5 rounded-full bg-success" />
        </span>
        Live
      </div>
    </motion.div>
  );
}
