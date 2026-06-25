"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

interface AnnouncementBarProps {
  onAction?: () => void;
}

const DISMISS_KEY = "useroutr_announce_v1";

export function AnnouncementBar({ onAction }: AnnouncementBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY) !== "1") setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="relative z-50 bg-ink text-bg">
      <div className="container-x relative flex h-10 items-center justify-center gap-3 text-[13px]">
        <span
          className="eyebrow text-bg/60"
          style={{ letterSpacing: "0.16em" }}
        >
          New
        </span>
        <button
          type="button"
          onClick={onAction}
          className="group inline-flex items-center gap-1.5 text-bg/90 transition-colors hover:text-bg"
        >
          <span>Join the private beta</span>
          <ArrowRight
            className="size-3.5 transition group-hover:translate-x-0.5"
            strokeWidth={1.6}
          />
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-bg/60 transition hover:bg-bg/10 hover:text-bg"
        >
          <X className="size-3.5" strokeWidth={1.6} />
        </button>
      </div>
    </div>
  );
}
