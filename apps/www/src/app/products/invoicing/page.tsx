import { ProductStoryLayout } from "@/components/stories/ProductStoryLayout";

const features = [
  "PDF + hosted page generated from the same JSON",
  "Line items, taxes, discounts, partial payments",
  "Multi-currency: invoice in EUR, settle in USDC",
  "Automatic dunning: reminders at +3, +7, +14 days overdue",
  "Webhook on invoice.paid, invoice.overdue, invoice.cancelled",
  "CSV export for accountants",
];

const apiRequest = `POST /v1/invoices
{
  "customer_email": "ap@acme.com",
  "customer_name": "Acme Inc.",
  "line_items": [
    { "description": "April retainer", "qty": 1, "unit_price": 5000, "amount": 5000 }
  ],
  "currency": "USD",
  "due_date": "2026-05-31"
}`;

const apiResponse = `→ {
  "id": "inv_abc123",
  "invoice_number": "INV-2026-042",
  "pdf_url": "https://...",
  "pay_url": "https://pay.useroutr.com/inv_abc123"
}`;

export const metadata = {
  title: "Invoicing — Useroutr",
  description:
    "Send a PDF invoice with a payment URL baked in. Customer pays in USDC, card, or bank transfer — you reconcile automatically.",
};

export default function InvoicingPage() {
  return (
    <ProductStoryLayout title="Invoicing" category="Pay-by-Link">
      {/* Hero */}
      <section className="min-h-screen flex items-center px-6 md:px-20 pt-32 pb-20">
        <div className="max-w-3xl space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-600">
            Invoicing
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold italic tracking-tighter text-white leading-[1.0]">
            Invoices that get paid.
            <br />
            In minutes, not weeks.
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed font-light max-w-xl">
            Send a PDF invoice with a payment URL baked in. Customer pays in
            USDC, card, or bank transfer — you reconcile automatically. Built
            for B2B teams that hate Stripe-style &ldquo;click here to enable
            Treasury.&rdquo;
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
