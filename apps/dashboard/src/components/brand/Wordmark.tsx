interface WordmarkProps {
  className?: string;
  hideWordmark?: boolean;
}

/**
 * Useroutr combination mark — geometric icon + lowercase wordmark.
 * Mirrors the mark used on the marketing site so the brand reads continuously
 * from useroutr.com → dashboard.useroutr.com.
 */
export function Wordmark({ className, hideWordmark }: WordmarkProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <svg
        viewBox="0 0 28 28"
        className="h-7 w-7 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect x="1" y="1" width="26" height="26" rx="6" fill="var(--lead)" />
        <path
          d="M8 10 C 10 14, 12 14, 14 14 C 16 14, 18 10, 20 10"
          stroke="var(--bg)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M8 18 C 10 14, 12 14, 14 14 C 16 14, 18 18, 20 18"
          stroke="var(--bg)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="14" cy="14" r="1.4" fill="var(--bg)" />
      </svg>
      {!hideWordmark && (
        <span
          className="text-[18px] font-semibold tracking-[-0.04em] text-foreground"
          style={{ fontFamily: "var(--font-display)" }}
        >
          useroutr
        </span>
      )}
    </div>
  );
}
