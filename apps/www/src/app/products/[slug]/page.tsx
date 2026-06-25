import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { PageEnter } from "@/components/site/PageEnter";
import { PageMast } from "@/components/v2/PageMast";
import { getProductBySlug, PRODUCT_PAGES } from "@/lib/product-pages";

export function generateStaticParams() {
  const canonical = PRODUCT_PAGES.map((p) => ({ slug: p.slug }));
  const legacy = [{ slug: "gateway" }, { slug: "payouts" }, { slug: "invoicing" }];
  return [...canonical, ...legacy];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) {
    return { title: "Product — Useroutr" };
  }

  return {
    title: `${product.name} — Useroutr`,
    description: product.summary,
    alternates: { canonical: `/products/${product.slug}` },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) {
    notFound();
  }

  return (
    <PageShell>
      <PageEnter>
        <section className="border-b border-rule bg-bg-soft/45 py-3">
          <div className="container-x">
            <Link
              href="/products"
              className="group inline-flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors hover:text-ink"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <ArrowLeft className="size-3.5 transition group-hover:-translate-x-0.5" />
              All products
            </Link>
          </div>
        </section>

        <PageMast
          eyebrow={product.category}
          title={
            <>
              {product.name} <span className="editorial-italic text-ink-2">for global teams</span>.
            </>
          }
          description={product.summary}
        />

        <section className="border-t border-rule py-20 md:py-28">
          <div className="container-x grid grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
            <div className="md:col-span-7">
              <h2
                className="text-[32px] leading-[1.06] tracking-[-0.03em] text-ink md:text-[44px]"
                style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Why teams choose {product.name.toLowerCase()}.
              </h2>
              <p className="mt-6 text-[16px] leading-relaxed text-ink-2 md:text-[18px]">
                {product.description}
              </p>

              <ul className="mt-8 space-y-3.5">
                {product.bullets.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-[15px] text-ink-2 md:text-[16px]">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="md:col-span-5">
              <div className="rounded-3xl border border-rule bg-bg-card p-7 md:p-8">
                <span
                  className="text-[11px] uppercase tracking-[0.16em] text-ink-3"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Next step
                </span>
                <h3
                  className="mt-3 text-[26px] leading-[1.1] tracking-[-0.025em] text-ink"
                  style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
                >
                  Build in days, not quarters.
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                  Use our API reference and sandbox to ship your first production-ready flow quickly.
                </p>

                <div className="mt-7 flex flex-col gap-3">
                  <Link
                    href={product.primaryCta.href}
                    target={product.primaryCta.href.startsWith("http") ? "_blank" : undefined}
                    rel={product.primaryCta.href.startsWith("http") ? "noreferrer" : undefined}
                    className="magnet"
                  >
                    <span className="pill pill-dark w-full justify-center">
                      {product.primaryCta.label}
                      <ArrowRight className="size-4" strokeWidth={1.6} />
                    </span>
                  </Link>
                  <Link
                    href={product.secondaryCta.href}
                    className="group inline-flex items-center justify-center gap-1 text-[14px] text-ink-2 transition-colors hover:text-ink"
                  >
                    <span className="link-underline">{product.secondaryCta.label}</span>
                    <ArrowUpRight
                      className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      strokeWidth={1.6}
                    />
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </PageEnter>
    </PageShell>
  );
}
