import Link from "next/link";
import { type ReactNode } from "react";
import { Wordmark } from "./Wordmark";

type Variant =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify";

interface Props {
  /** Kept for backwards compat with existing pages — no longer used in the
   *  minimalist centered layout. Safe to remove call-site arg later. */
  illustration?: Variant;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Footer area below the form — typically a Sign in / Sign up link */
  footnote?: ReactNode;
}

/**
 * Minimalist centered auth shell.
 *
 * One column, the form anchored on the page, generous vertical breathing room,
 * the marketing site's editorial voice. Strips the previous split-pane +
 * illustration so the conversion path is the form and nothing else.
 *
 * Brand chrome lives in three thin bands — wordmark top, form middle, legal
 * row bottom — so any auth page (login, register, verify, reset…) feels
 * structurally the same and pages off to the dashboard once you're in.
 */
export function AuthScaffold({
  eyebrow,
  title,
  description,
  children,
  footnote,
}: Props) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header — just the wordmark, no other chrome */}
      <header className="px-6 pt-8 md:px-10 md:pt-10">
        <Link
          href="https://useroutr.com"
          aria-label="Useroutr — home"
          className="inline-block"
        >
          <Wordmark />
        </Link>
      </header>

      {/* Form column — vertically centered, ~420px wide */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 md:px-10 md:py-16">
        <div className="page-enter w-full max-w-[420px]">
          {eyebrow && (
            <div
              className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {eyebrow}
            </div>
          )}
          <h1
            className="mt-3 text-[34px] leading-[1.04] tracking-[-0.04em] text-foreground md:text-[40px]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          <div className="mt-8">{children}</div>
          {footnote && (
            <div className="mt-8 text-[14px] text-muted-foreground">
              {footnote}
            </div>
          )}
        </div>
      </main>

      {/* Footer — light legal row */}
      <footer className="px-6 pb-8 md:px-10">
        <div
          className="mx-auto flex max-w-[420px] flex-wrap items-center justify-between gap-3 text-[11.5px] text-muted-foreground"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>© {new Date().getFullYear()} Useroutr Labs, Inc.</span>
          <div className="flex items-center gap-4">
            <Link
              href="https://useroutr.com/terms"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Terms
            </Link>
            <Link
              href="https://useroutr.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="https://status.useroutr.com"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
