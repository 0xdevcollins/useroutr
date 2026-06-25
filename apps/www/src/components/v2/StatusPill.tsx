"use client";

import { useEffect, useState } from "react";

type Health = "operational" | "degraded" | "unknown";

interface StatusResponse {
  status: Health;
}

const PILL_STATE: Record<
  Health,
  { label: string; dotClass: string; pulse: boolean }
> = {
  operational: {
    label: "All systems normal",
    dotClass: "bg-[#1f6c43]",
    pulse: true,
  },
  degraded: {
    label: "Degraded performance",
    dotClass: "bg-[#c2761f]",
    pulse: true,
  },
  unknown: {
    label: "Status",
    dotClass: "bg-ink-3",
    pulse: false,
  },
};

/**
 * Footer status pill — reflects the live `/readyz` aggregate via the
 * marketing site's `/api/status` proxy. Starts in "unknown" until the
 * fetch resolves so we never claim "all systems normal" before we've
 * actually asked.
 */
export function StatusPill() {
  const [status, setStatus] = useState<Health>("unknown");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<StatusResponse>) : null))
      .then((body) => {
        if (body?.status) setStatus(body.status);
      })
      .catch(() => {
        // Network errors leave the pill in "unknown".
      });
    return () => controller.abort();
  }, []);

  const state = PILL_STATE[status];

  return (
    <a
      href="https://status.useroutr.com"
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-rule px-3 py-1.5 text-[11.5px] text-ink-2 transition hover:border-ink hover:text-ink"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <span
        className={`size-1.5 rounded-full ${state.dotClass} ${state.pulse ? "pulse-soft" : ""}`}
      />
      {state.label}
    </a>
  );
}
