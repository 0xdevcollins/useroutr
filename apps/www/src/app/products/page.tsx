import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";
import { PRODUCT_PAGES } from "@/lib/product-pages";

export const metadata: Metadata = {
  title: "Products — Useroutr",
  description:
    "Explore Useroutr products for checkout, payment links, invoicing, and global payouts.",
  alternates: { canonical: "/products" },
};

export default function ProductsIndexPage() {
  return (
    <PageShell>
      <PageEnter>
        <PageMast
          eyebrow="Products"
          title={
            <>
              Four products. <span className="editorial-italic text-ink-2">One API.</span>
            </>
          }
          description="Each module is standalone, but they share one ledger, one webhook contract, and one reconciliation model. Start with one and add the rest without replatforming."
        />

        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x">
            <div className="mx-auto grid max-w-[1100px] grid-cols-1 gap-5 md:grid-cols-2">
              {PRODUCT_PAGES.map((product) => (
                <article
                  key={product.slug}
                  className="flex h-full flex-col rounded-3xl border border-rule bg-bg-card p-7 md:p-8"
                >
                  <span
                    className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {product.category}
                  </span>
                  <h2
                    className="mt-3 text-[28px] leading-[1.08] tracking-[-0.03em] text-ink md:text-[36px]"
                    style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                  >
                    {product.name}
                  </h2>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-2 md:text-[16px]">
                    {product.summary}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {product.bullets.slice(0, 3).map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-[14px] text-ink-2">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex items-center gap-4">
                    <Link href={`/products/${product.slug}`} className="magnet">
                      <span className="pill pill-dark py-2.5 text-[13px]">
                        View product
                        <ArrowRight className="size-4" strokeWidth={1.6} />
                      </span>
                    </Link>
                    <Link
                      href={product.primaryCta.href}
                      target={product.primaryCta.href.startsWith("http") ? "_blank" : undefined}
                      rel={product.primaryCta.href.startsWith("http") ? "noreferrer" : undefined}
                      className="group inline-flex items-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
                    >
                      <span className="link-underline">{product.primaryCta.label}</span>
                      <ArrowUpRight
                        className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        strokeWidth={1.6}
                      />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}