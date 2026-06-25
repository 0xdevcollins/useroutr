"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type Variant =
  | "payments"
  | "payouts"
  | "invoices"
  | "links"
  | "team"
  | "webhooks"
  | "api-keys";

interface Props {
  variant: Variant;
  title: string;
  body: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondary?: ReactNode;
}

/**
 * Reusable empty state for any dashboard list. Renders a per-variant
 * line illustration on top, an editorial heading, body, and optional
 * primary + secondary CTAs. Same visual vocabulary as the marketing
 * site illustrations.
 */
export function EmptyState({ variant, title, body, cta, secondary }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="surface flex flex-col items-center gap-6 px-6 py-14 text-center"
    >
      <Illustration variant={variant} />
      <div className="max-w-md">
        <h3
          className="text-[24px] tracking-[-0.025em] text-foreground md:text-[28px]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {title}
        </h3>
        <p className="mt-3 text-[15px] text-muted-foreground">{body}</p>
      </div>
      {(cta || secondary) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {cta &&
            (cta.href ? (
              <Link href={cta.href}>
                <span className="magnet pill pill-dark">
                  {cta.label}
                  <ArrowRight className="size-4" strokeWidth={1.6} />
                </span>
              </Link>
            ) : (
              <button type="button" onClick={cta.onClick}>
                <span className="magnet pill pill-dark">
                  {cta.label}
                  <ArrowRight className="size-4" strokeWidth={1.6} />
                </span>
              </button>
            ))}
          {secondary}
        </div>
      )}
    </motion.div>
  );
}

function Illustration({ variant }: { variant: Variant }) {
  return (
    <svg
      viewBox="0 0 240 160"
      className="h-32 w-auto"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden
    >
      <rect width="240" height="160" fill="var(--bg-soft)" rx="8" />
      {variant === "payments" && <Payments />}
      {variant === "payouts" && <Payouts />}
      {variant === "invoices" && <Invoices />}
      {variant === "links" && <Links />}
      {variant === "team" && <Team />}
      {variant === "webhooks" && <Webhooks />}
      {variant === "api-keys" && <ApiKeys />}
    </svg>
  );
}

function Payments() {
  return (
    <g>
      <rect
        x="40"
        y="40"
        width="160"
        height="80"
        rx="8"
        fill="var(--bg-card)"
        stroke="var(--lead)"
        strokeWidth="1.2"
      />
      <text
        x="56"
        y="64"
        fontSize="8"
        fontFamily="var(--font-mono)"
        fill="var(--faint)"
      >
        PAYMENT · pay_xyz789
      </text>
      <text
        x="56"
        y="86"
        fontSize="18"
        fontFamily="var(--font-display)"
        fontWeight="600"
        fill="var(--lead)"
      >
        $100.00 USD
      </text>
      <rect x="56" y="98" width="60" height="14" rx="7" fill="var(--accent)" />
      <text
        x="86"
        y="108"
        textAnchor="middle"
        fontSize="7"
        fontFamily="var(--font-mono)"
        fill="#fff"
      >
        PAID
      </text>
      {/* Decorative pulse ring */}
      <circle
        cx="184"
        cy="80"
        r="14"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.2"
        strokeOpacity="0.4"
      />
      <circle cx="184" cy="80" r="6" fill="var(--accent)" />
      <path
        d="M180 80.5 L183 83 L189 77"
        stroke="#fff"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Payouts() {
  return (
    <g>
      <rect x="20" y="60" width="60" height="40" rx="6" fill="var(--lead)" />
      <text
        x="50"
        y="78"
        textAnchor="middle"
        fontSize="8"
        fontFamily="var(--font-display)"
        fontWeight="500"
        fill="#fff"
      >
        SOURCE
      </text>
      <text
        x="50"
        y="90"
        textAnchor="middle"
        fontSize="7"
        fontFamily="var(--font-mono)"
        fill="var(--faint)"
      >
        $40,000
      </text>

      {[55, 80, 105].map((y, i) => (
        <g key={i}>
          <path
            d={`M80 80 Q 110 80, 130 ${y}`}
            stroke="var(--lead)"
            strokeWidth="1"
            strokeDasharray="2 2"
            fill="none"
          />
          <rect
            x="130"
            y={y - 8}
            width="80"
            height="16"
            rx="8"
            fill="var(--bg-card)"
            stroke="var(--lead)"
            strokeWidth="1"
          />
          <circle cx="142" cy={y} r="3" fill="var(--accent)" />
          <text
            x="152"
            y={y + 3}
            fontSize="7"
            fontFamily="var(--font-mono)"
            fill="var(--lead)"
          >
            RECIPIENT 0{i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

function Invoices() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g
          key={i}
          transform={`rotate(${(i - 1) * 4} 120 80) translate(${(i - 1) * 6} ${(i - 1) * -4})`}
        >
          <rect
            x="80"
            y="30"
            width="80"
            height="100"
            rx="3"
            fill="var(--bg-card)"
            stroke="var(--lead)"
            strokeWidth="1"
          />
          <text
            x="90"
            y="50"
            fontSize="11"
            fontFamily="var(--font-display)"
            fontWeight="600"
            fill="var(--lead)"
          >
            Invoice
          </text>
          <text
            x="90"
            y="62"
            fontSize="6"
            fontFamily="var(--font-mono)"
            fill="var(--faint)"
          >
            INV-004{i + 1}
          </text>
          {[0, 1, 2].map((line) => (
            <line
              key={line}
              x1="90"
              y1={76 + line * 10}
              x2="150"
              y2={76 + line * 10}
              stroke="var(--lead)"
              strokeOpacity="0.3"
              strokeWidth="0.6"
            />
          ))}
          <rect
            x="90"
            y="110"
            width="40"
            height="10"
            rx="5"
            fill={i === 2 ? "var(--accent)" : "none"}
            stroke={i === 2 ? "none" : "var(--lead)"}
            strokeWidth="0.8"
          />
          <text
            x="110"
            y="117"
            textAnchor="middle"
            fontSize="6"
            fontFamily="var(--font-mono)"
            fill={i === 2 ? "#fff" : "var(--faint)"}
          >
            {["DRAFT", "SENT", "PAID"][i]}
          </text>
        </g>
      ))}
    </g>
  );
}

function Links() {
  return (
    <g>
      <rect
        x="30"
        y="60"
        width="180"
        height="40"
        rx="20"
        fill="var(--bg-card)"
        stroke="var(--lead)"
        strokeWidth="1.2"
      />
      <circle cx="58" cy="80" r="8" fill="var(--accent)" />
      <path
        d="M53 80 L57 84 L63 76"
        stroke="#fff"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="74"
        y="78"
        fontSize="7"
        fontFamily="var(--font-mono)"
        fill="var(--faint)"
      >
        useroutr.com/L
      </text>
      <text
        x="74"
        y="90"
        fontSize="11"
        fontFamily="var(--font-display)"
        fontWeight="500"
        fill="var(--lead)"
      >
        /pay/abc-123
      </text>
      <rect
        x="170"
        y="72"
        width="32"
        height="16"
        rx="8"
        fill="var(--bg-soft)"
        stroke="var(--lead)"
        strokeWidth="0.8"
      />
      <text
        x="186"
        y="83"
        textAnchor="middle"
        fontSize="7"
        fontFamily="var(--font-mono)"
        fill="var(--lead)"
      >
        COPY
      </text>
    </g>
  );
}

function Team() {
  return (
    <g>
      {[80, 120, 160].map((cx, i) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy="80"
            r="20"
            fill={i === 1 ? "var(--accent)" : "var(--bg-card)"}
            stroke="var(--lead)"
            strokeWidth="1.2"
          />
          <text
            x={cx}
            y="84"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-display)"
            fontWeight="600"
            fill={i === 1 ? "#fff" : "var(--lead)"}
          >
            {["JD", "AC", "MK"][i]}
          </text>
        </g>
      ))}
      <line
        x1="100"
        y1="80"
        x2="120"
        y2="80"
        stroke="var(--rule2)"
        strokeWidth="1"
      />
      <line
        x1="140"
        y1="80"
        x2="160"
        y2="80"
        stroke="var(--rule2)"
        strokeWidth="1"
      />
    </g>
  );
}

function Webhooks() {
  return (
    <g>
      <rect x="20" y="60" width="60" height="40" rx="6" fill="var(--lead)" />
      <text
        x="50"
        y="84"
        textAnchor="middle"
        fontSize="9"
        fontFamily="var(--font-mono)"
        fill="#fff"
      >
        POST
      </text>
      <path
        d="M80 80 L160 80"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeDasharray="4 4"
      />
      <path
        d="M155 76 L162 80 L155 84"
        stroke="var(--accent)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="160"
        y="60"
        width="60"
        height="40"
        rx="6"
        fill="var(--bg-card)"
        stroke="var(--lead)"
        strokeWidth="1.2"
      />
      <text
        x="190"
        y="78"
        textAnchor="middle"
        fontSize="7"
        fontFamily="var(--font-mono)"
        fill="var(--faint)"
      >
        YOUR API
      </text>
      <text
        x="190"
        y="92"
        textAnchor="middle"
        fontSize="9"
        fontFamily="var(--font-display)"
        fontWeight="500"
        fill="var(--lead)"
      >
        200 OK
      </text>
    </g>
  );
}

function ApiKeys() {
  return (
    <g>
      <rect
        x="40"
        y="60"
        width="160"
        height="40"
        rx="8"
        fill="var(--bg-card)"
        stroke="var(--lead)"
        strokeWidth="1.2"
      />
      <text
        x="56"
        y="78"
        fontSize="9"
        fontFamily="var(--font-mono)"
        fill="var(--faint)"
      >
        SECRET KEY
      </text>
      <text
        x="56"
        y="92"
        fontSize="11"
        fontFamily="var(--font-mono)"
        fill="var(--lead)"
      >
        ur_live_••••••••••
      </text>
      <rect x="170" y="72" width="20" height="16" rx="4" fill="var(--accent)" />
      <circle
        cx="180"
        cy="80"
        r="5"
        fill="none"
        stroke="#fff"
        strokeWidth="1.4"
      />
      <line
        x1="180"
        y1="76"
        x2="180"
        y2="80"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
}
