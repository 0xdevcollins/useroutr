"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

interface PageMastProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  /** Optional slot rendered below the description — CTAs, chips, etc. */
  children?: ReactNode;
}

/**
 * Editorial masthead used by all non-home info pages (About, Customers,
 * Press, Changelog, Legal). Keeps the page rhythm consistent with the home.
 */
export function PageMast({
  eyebrow,
  title,
  description,
  meta,
  children,
}: PageMastProps) {
  return (
    <section className="relative pt-14 pb-12 md:pt-20 md:pb-20">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease }}
          className="mx-auto max-w-[960px]"
        >
          {eyebrow && (
            <div
              className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="mt-4 text-[44px] leading-[1.01] tracking-[-0.045em] text-ink md:text-[72px] lg:text-[88px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-6 max-w-[640px] text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
              {description}
            </p>
          )}
          {meta && (
            <div
              className="mt-6 text-[12px] uppercase tracking-[0.14em] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {meta}
            </div>
          )}
          {children && <div className="mt-8">{children}</div>}
        </motion.div>
      </div>
    </section>
  );
}
