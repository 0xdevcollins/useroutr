import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import type { Metadata } from "next";

const products = [
  {
    label: "Hosted checkout",
    description: "Stripe-style branded checkout. USDC + card + bank, one URL.",
    href: "/products/hosted-checkout",
  },
  {
    label: "Pay by link",
    description: "One-link payment requests. No code, no checkout to build.",
    href: "/products/pay-by-link",
  },
  {
    label: "Invoicing",
    description: "Send a PDF invoice, get paid in USDC or fiat.",
    href: "/products/invoicing",
  },
  {
    label: "Global payouts",
    description: "Bulk disbursements to 174 countries.",
    href: "/products/payouts",
  },
];

export const metadata: Metadata = {
  title: "Products — Useroutr",
  description:
    "One engine. Four ways to use it. Accept, route, settle, and notify — pick the surface that fits your business.",
  alternates: { canonical: "/products" },
};

export default function ProductsIndexPage() {
  return (
    <PageShell>
      <div className="min-h-screen bg-black text-white">
        {/* Hero */}
        <section className="pt-40 pb-20 px-6 max-w-5xl mx-auto">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 mb-6">
            Products
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold italic tracking-tighter text-white leading-[1.0]">
            One engine.
            <br />
            Four ways to use it.
          </h1>
          <p className="mt-8 max-w-xl text-lg text-zinc-400 leading-relaxed font-light">
            The same primitives — accept, route, settle, notify — power every
            product on Useroutr. Pick the surface that fits your business.
          </p>
        </section>

        {/* Product cards */}
        <section className="pb-32 px-6 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="group relative flex flex-col justify-between p-8 rounded-2xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all duration-200"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mb-3">
                    Useroutr
                  </p>
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                    {p.label}
                  </h2>
                  <p className="mt-3 text-[15px] text-zinc-400 leading-relaxed">
                    {p.description}
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-zinc-500 group-hover:text-white transition-colors text-sm font-mono uppercase tracking-widest">
                  <span>Learn more</span>
                  <ArrowRight
                    size={14}
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
