"use client";

import Link from "next/link";
import { Wordmark } from "@/components/site/Wordmark";
import { BrandLogo } from "./BrandLogo";
import { BRAND_LOGOS } from "@/lib/brand-logos";

type LinkItem = { label: string; href: string; external?: boolean };

const columns: { title: string; links: LinkItem[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/pricing" },
      {
        label: "Become a design partner",
        href: "mailto:founders@useroutr.com",
      },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "https://docs.useroutr.com", external: true },
      {
        label: "API reference",
        href: "https://docs.useroutr.com",
        external: true,
      },
      { label: "GitHub", href: "https://github.com/useroutr", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
];

const socials = [
  { brand: "github", href: "https://github.com/useroutr" },
  { brand: "x", href: "https://x.com/useroutr" },
  { brand: "linkedin", href: "https://linkedin.com/company/useroutr" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-rule bg-bg pt-16 pb-10 md:pt-20">
      <div className="container-x">
        <div className="grid grid-cols-2 gap-y-12 md:grid-cols-12 md:gap-x-12">
          {/* Brand block */}
          <div className="col-span-2 md:col-span-4">
            <Link
              href="/"
              aria-label="Useroutr — home"
              className="inline-block"
            >
              <Wordmark className="h-7" />
            </Link>
            <p className="mt-5 max-w-[320px] text-[14px] leading-relaxed text-ink-2">
              The payout platform for businesses paying Africa.{" "}
              <span className="text-ink">
                Any chain in, local rails out — settled on Stellar.
              </span>
            </p>
            <a
              href="mailto:founders@useroutr.com"
              className="mt-5 inline-block text-[13px] text-ink-3 underline decoration-rule-2 decoration-from-font underline-offset-4 transition hover:text-ink"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              founders@useroutr.com
            </a>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title} className="md:col-span-2">
              <span
                className="text-[11px] uppercase tracking-[0.14em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {col.title}
              </span>
              <ul className="mt-5 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noreferrer" : undefined}
                      className="text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                    >
                      {l.label}
                      {l.external && (
                        <span className="ml-1 text-ink-4" aria-hidden>
                          ↗
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col gap-4 border-t border-rule pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className="text-[12px] text-ink-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              © {new Date().getFullYear()} Useroutr
            </span>
            <span className="max-w-[440px] text-[12px] leading-relaxed text-ink-4">
              Useroutr is a software platform; fiat payout services are provided
              by licensed partners.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {socials.map((s) => {
              const label = BRAND_LOGOS[s.brand]?.label ?? s.brand;
              return (
                <a
                  key={s.brand}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid size-9 place-items-center rounded-full border border-rule transition hover:border-ink"
                >
                  <BrandLogo id={s.brand} size="xs" shape="square" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}
