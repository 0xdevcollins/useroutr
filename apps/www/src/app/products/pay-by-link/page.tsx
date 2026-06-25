import { ProductStoryLayout } from "@/components/stories/ProductStoryLayout";

const features = [
  "Fixed amount, open amount, or pick-from-list",
  "Single-use or multi-use links",
  "Custom expiry windows",
  "Per-link conversion stats (views vs. payments)",
  "QR code generated automatically",
  "Works with any payment method the customer picks",
];

const apiRequest = `POST /v1/payment-links
{
  "amount": 25,
  "currency": "USD",
  "description": "Coffee subscription · April",
  "single_use": false,
  "expires_at": "2026-06-01T00:00:00Z"
}`;

const apiResponse = `→ {
  "id": "lnk_abc123",
  "url": "https://pay.useroutr.com/abc12345",
  "qr_code_url": "data:image/png;base64,..."
}`;

export const metadata = {
  title: "Pay by Link — Useroutr",
  description:
    "Generate a payment URL with one API call. Share it on email, Slack, WhatsApp, an invoice, or a QR code.",
};

export default function PayByLinkPage() {
  return (
    <ProductStoryLayout title="Pay by Link" category="Payments">
      {/* Hero */}
      <section className="min-h-screen flex items-center px-6 md:px-20 pt-32 pb-20">
        <div className="max-w-3xl space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            Pay by Link
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold italic tracking-tighter text-white leading-[1.0]">
            The link is
            <br />
            the integration.
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light max-w-xl">
            Generate a payment URL with one API call (or one button in the
            dashboard). Share it on email, Slack, WhatsApp, an invoice, or a QR
            code. Customers pay — you get a webhook.
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
