"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  /** Mono uppercase eyebrow above the title */
  eyebrow?: string;
  /** Main title — pass JSX so you can drop an <span className="editorial-italic"> in */
  title: ReactNode;
  /** Supporting paragraph beneath the title */
  description?: ReactNode;
  /** Right-aligned area: usually a pill CTA, filter, or theme-style dropdown */
  actions?: ReactNode;
}

/**
 * Editorial header for any dashboard page. Mirrors the GreetingHeader
 * pattern from the overview — mono eyebrow, big display title in Hanken
 * with optional Fraunces italic, optional description, optional right
 * actions slot. Sits on its own hairline rule so the rest of the page
 * has a clean seam to start from.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 border-b border-rule pb-6 md:flex-row md:items-end md:justify-between md:gap-8"
    >
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1
          className="mt-3 text-[32px] leading-[1.05] tracking-[-0.035em] text-foreground md:text-[40px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground md:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </motion.header>
  );
}
