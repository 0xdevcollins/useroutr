"use client";

import type { ReactNode } from "react";
import { PageMast } from "./PageMast";

export interface LegalSection {
  id: string;
  heading: string;
  body: ReactNode;
}

interface LegalShellProps {
  title: ReactNode;
  intro?: ReactNode;
  lastUpdated: string;
  sections: LegalSection[];
}

/**
 * Shared shell for the four legal pages (Terms, Privacy, Security,
 * Compliance). Renders an editorial masthead, then a 2-column layout
 * with a sticky table of contents on the left and the article body
 * on the right.
 */
export function LegalShell({
  title,
  intro,
  lastUpdated,
  sections,
}: LegalShellProps) {
  return (
    <>
      <PageMast
        eyebrow="Legal"
        title={title}
        description={intro}
        meta={`Last updated · ${lastUpdated}`}
      />

      <section className="border-t border-rule py-16 md:py-20">
        <div className="container-x grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
          {/* Table of contents */}
          <aside className="md:col-span-3">
            <div className="md:sticky md:top-24">
              <div
                className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Contents
              </div>
              <ul className="mt-4 space-y-2.5">
                {sections.map((s, i) => (
                  <li key={s.id} className="flex items-baseline gap-3">
                    <span
                      className="w-5 text-[11px] text-ink-4"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <a
                      href={`#${s.id}`}
                      className="text-[13.5px] text-ink-2 transition-colors hover:text-ink"
                    >
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          {/* Body */}
          <article className="prose-tavvio md:col-span-9 max-w-[760px]">
            {sections.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 border-t border-rule pt-10 first:border-t-0 first:pt-0"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="text-[12px] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <h2
                    className="text-[24px] leading-[1.15] tracking-[-0.025em] text-ink md:text-[30px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {s.heading}
                  </h2>
                </div>
                <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-2 md:text-[16px]">
                  {s.body}
                </div>
              </section>
            ))}
          </article>
        </div>
      </section>
    </>
  );
}
