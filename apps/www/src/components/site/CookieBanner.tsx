"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const COOKIE_BANNER_KEY = "useroutr_cookie_banner_dismissed";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.localStorage.getItem(COOKIE_BANNER_KEY) === "true") {
      return;
    }

    setVisible(true);
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(COOKIE_BANNER_KEY, "true");
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-bg px-4 py-4 shadow-[0_-12px_32px_rgba(0,0,0,0.08)] md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 rounded-3xl border border-rule bg-surface p-5 text-sm text-ink shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2 text-[13px] leading-relaxed text-ink-2 md:max-w-3xl">
          <p className="text-ink">We use cookies sparingly. Almost everything on useroutr.com works without them; we only set the cookies needed to keep you signed in and to measure whether the site is actually working.</p>
          <p>
            <Link
              href="/cookies"
              className="text-ink underline decoration-rule-2 decoration-from-font underline-offset-4 hover:text-ink"
            >
              More info
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center justify-center rounded-full border border-ink/10 bg-ink/5 px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-ink hover:bg-ink/10"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
