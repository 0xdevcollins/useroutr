import { ProductStoryLayout } from "@/components/stories/ProductStoryLayout";

const features = [
  "Embed via URL or iframe — no SDK required",
  "Auto-applies your logo, brand color, company name",
  "Customer picks payment method; you settle in one asset",
  "Idempotent re-render: customer can refresh during sign without losing state",
  "Webhook on every state change",
];

const apiRequest = `POST /v1/checkout/sessions
{
  "amount": 100.00,
  "currency": "USD",
  "success_url": "https://yourapp.com/thanks",
  "metadata": { "order_id": "ord_123" }
}`;

const apiResponse = `→ { "url": "https://checkout.useroutr.com/cs_abc123" }`;

export const metadata = {
  title: "Hosted Checkout — Useroutr",
  description:
    "A drop-in payment page that accepts USDC on five chains, cards via Stripe, bank transfers via ACH or SEPA, and fiat on-ramp through MoneyGram.",
};

export default function HostedCheckoutPage() {
  return (
    <ProductStoryLayout title="Hosted Checkout" category="Payments">
      {/* Hero */}
      <section className="min-h-screen flex items-center px-6 md:px-20 pt-32 pb-20">
        <div className="max-w-3xl space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            Hosted Checkout
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold italic tracking-tighter text-white leading-[1.0]">
            Branded checkout.
            <br />
            One URL.
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light max-w-xl">
            A drop-in payment page that accepts USDC on five chains, cards via
            Stripe, bank transfers via ACH or SEPA, and fiat on-ramp through
            MoneyGram. The customer never leaves your brand.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-20 py-24 border-t border-white/5">
        <div className="max-w-3xl space-y-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            What&apos;s included
          </p>
          <ul className="space-y-5">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-4">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
                <span className="text-[17px] text-zinc-300 leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* API example */}
      <section className="px-6 md:px-20 py-24 border-t border-white/5">
        <div className="max-w-3xl space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            API example
          </p>
          <pre className="rounded-xl bg-white/3 border border-white/8 p-6 overflow-x-auto text-sm text-zinc-300 font-mono leading-relaxed whitespace-pre">
            {apiRequest}
          </pre>
          <pre className="rounded-xl bg-white/3 border border-white/8 p-6 overflow-x-auto text-sm text-emerald-400 font-mono leading-relaxed whitespace-pre">
            {apiResponse}
          </pre>
        </div>
      </section>
    </ProductStoryLayout>
  );
}
