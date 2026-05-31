"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  className?: string;
  size?: "sm" | "md";
}

/**
 * Theme toggle — single icon button that swaps Sun ↔ Moon with a soft
 * scale/blur transition. Reads the current mode from the dashboard's
 * ThemeProvider and toggles a `light` / `dark` class on `<html>`.
 */
export function ThemeToggle({ className, size = "md" }: Props) {
  const { theme, toggleTheme } = useTheme();
  const dimension = size === "sm" ? "size-8" : "size-9";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative inline-flex ${dimension} items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary ${className ?? ""}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ scale: 0.7, opacity: 0, rotate: -45, filter: "blur(4px)" }}
          animate={{ scale: 1, opacity: 1, rotate: 0, filter: "blur(0px)" }}
          exit={{ scale: 0.7, opacity: 0, rotate: 45, filter: "blur(4px)" }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 grid place-items-center"
        >
          <Icon className="size-4" strokeWidth={1.6} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
