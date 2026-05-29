tsx
// PricingPage.tsx
// Production-grade pricing page component for /pricing route.
// Features: full type safety, error boundary, logging, accessibility, memoization, clean code.

import React, {
  memo,
  useCallback,
  useMemo,
  useState,
  useEffect,
  type FC,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------
import { PageShell } from '@/components/layout/PageShell';
import { PageEnter } from '@/components/layout/PageEnter';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { ContactSalesModal } from '@/components/pricing/ContactSalesModal';
import { PricingCard } from '@/components/pricing/PricingCard';
import { VolumePricingStrip } from '@/components/pricing/VolumePricingStrip';
import { NoChargeList } from '@/components/pricing/NoChargeList';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
// ---------------------------------------------------------------------------
// Logging & Analytics
// ---------------------------------------------------------------------------
import { logEvent, LogLevel } from '@/lib/logger';
import { track, type AnalyticsEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row definition for the add‑on fees table. */
export interface AddonRow {
  readonly service: string;
  readonly cost: string;
}

/** Volume discount tier. */
export interface VolumeTier {
  readonly volume: string;
  readonly rate: string;
  readonly isCta?: boolean;
}

// ---------------------------------------------------------------------------
// Constants (immutable, type‑safe)
// ---------------------------------------------------------------------------

/** Primary pricing tier data (readonly tuple for safety). */
const TIER = {
  name: 'Starter' as const,
  rate: '0.5%' as const,
  dropRate: '0.35%' as const,
  dropThreshold: '$50,000 / month' as const,
  features: [
    'All payment methods (card, bank, crypto, mobile money)',
    'Hosted checkout + pay-by-link + invoices',
    'Global payouts to 174 countries',
    'Managed Stellar settlement wallet',
    'Webhooks + SDKs + sandbox',
    'Standard support (email, 1 business day)',
  ] as readonly string[],
} as const;

/** Add‑on fee rows (immutable array). */
const ADDON_ROWS: readonly AddonRow[] = [
  { service: 'Card payments (Stripe)', cost: 'network fee pass-through, no markup' },
  { service: 'Bank transfers (ACH, SEPA)', cost: 'network fee pass-through, no markup' },
  { service: 'Crypto payments (CCTP V2)', cost: 'Circle protocol fee pass-through' },
  { service: 'Mobile money (M-Pesa, MTN)', cost: 'rail fee pass-through' },
  { service: 'Payouts', cost: 'included in 0.5%' },
  { service: 'FX conversion', cost: 'mid-market rate + 30 bps' },
  { service: 'Sandbox', cost: 'free, unlimited' },
  { service: 'Webhook retries', cost: 'included, exhaustion after 10 attempts' },
] as const;

/** Volume discount tiers (immutable array). */
const VOLUME_TIERS: readonly VolumeTier[] = [
  { volume: '$50,000 monthly volume', rate: '0.35%' },
  { volume: '$500,000 monthly volume', rate: '0.30%' },
  { volume: '$5,000,000 monthly volume', rate: "let's talk", isCta: true },
] as const;

/** Items we don’t charge for (immutable). */
const NO_CHARGE_ITEMS: readonly string[] = [
  'Setup fees',
  'Monthly minimums',
  'Hidden FX spreads',
  '"Express settlement" pr',
] as const;

// ---------------------------------------------------------------------------
// Helper: unified event logging & tracking
// ---------------------------------------------------------------------------

/**
 * Safely logs an analytics event and a log entry.
 * @param eventName - Name of the analytics event.
 * @param extra - Optional extra context for the log.
 */
function logAndTrack(
  eventName: AnalyticsEvent,
  extra?: Record<string, unknown>,
): void {
  try {
    track(eventName, extra ?? {});
    logEvent(LogLevel.INFO, `Analytics tracked: ${eventName}`, extra);
  } catch (err) {
    logEvent(LogLevel.ERROR, `Failed to track event: ${eventName}`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Safe navigation with error logging. */
function safeNavigate(url: string): void {
  try {
    window.location.href = url;
  } catch (navError) {
    logEvent(LogLevel.ERROR, `Navigation to ${url} failed`, {
      error: navError instanceof Error ? navError.message : String(navError),
    });
  }
}

// ---------------------------------------------------------------------------
// Sub‑components (memoized, documented)
// ---------------------------------------------------------------------------

/**
 * Hero section with headline, lead paragraph, and accent ribbon.
 */
const Hero: FC = memo(function Hero() {
  return (
    <Section
      as="header"
      className="relative border-b border-white/10 pb-16 pt-24"
      aria-label="Pricing header"
    >
      {/* Accent ribbon */}
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent-blue via-accent-purple to-accent-pink"
        role="presentation"
      />
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
          Plain pricing. No revenue share.
        </h1>
        <p className="mt-6 text-xl leading-relaxed text-gray-400">
          <em>What you&apos;d hope a payment processor would do.</em>
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500">
          One per-transaction fee, the same on every rail. Network costs pass through
          at cost — we never mark up the underlying chain or fiat rail.
        </p>
      </div>
    </Section>
  );
});

Hero.displayName = 'Hero';

/**
 * Pricing tier card section.
 */
const PricingTierCard: FC = memo(function PricingTierCard() {
  const handleCta = useCallback(() => {
    logAndTrack('pricing_cta_click', { button: 'start_building' });
    safeNavigate('/signup');
  }, []);

  return (
    <Section className="py-16" aria-label="Pricing tier card">
      <div className="mx-auto max-w-lg px-4">
        <PricingCard
          name={TIER.name}
          rate={TIER.rate}
          dropRate={TIER.dropRate}
          dropThreshold={TIER.dropThreshold}
          features={[...TIER.features]}
          onCtaClick={handleCta}
        />
      </div>
    </Section>
  );
});

PricingTierCard.displayName = 'PricingTierCard';

/**
 * Add‑on fee table section.
 */
const AddonTable: FC = memo(function AddonTable() {
  return (
    <Section className="border-t border-white/10 py-12" aria-label="Add-on fees">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-6 text-2xl font-semibold text-white">Add-on fees</h2>
        <Table variant="dark" aria-label="Add-on fee breakdown">
          <THead>
            <Tr>
              <Th scope="col">Service</Th>
              <Th scope="col">Cost</Th>
            </Tr>
          </THead>
          <TBody>
            {ADDON_ROWS.map((row, index) => (
              <Tr key={index}>
                <Td>{row.service}</Td>
                <Td>{row.cost}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
    </Section>
  );
});

AddonTable.displayName = 'AddonTable';

/**
 * Volume pricing strip section.
 * Manages the ContactSalesModal state internally.
 */
const VolumeStrip: FC = memo(function VolumeStrip() {
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);

  const handleContactSales = useCallback(() => {
    logAndTrack('pricing_cta_click', { button: 'contact_sales' });
    setIsSalesModalOpen(true);
  }, []);

  const handleCloseSalesModal = useCallback(() => {
    setIsSalesModalOpen(false);
  }, []);

  return (
    <Section className="border-t border-white/10 py-12" aria-label="Volume pricing">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="mb-8 text-2xl font-semibold text-white">Volume pricing</h2>
        <VolumePricingStrip tiers={[...VOLUME_TIERS]} onContactSales={handleContactSales} />
        {isSalesModalOpen && (
          <ContactSalesModal onClose={handleCloseSalesModal} />
        )}
      </div>
    </Section>
  );
});

VolumeStrip.displayName = 'VolumeStrip';

/**
 * Section listing what we don't charge for.
 */
const NoChargeSection: FC = memo(function NoChargeSection() {
  return (
    <Section className="border-t border-white/10 py-12" aria-label="No hidden fees">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="mb-6 text-2xl font-semibold text-white">What we don&apos;t charge for</h2>
        <NoChargeList items={[...NO_CHARGE_ITEMS]} />
      </div>
    </Section>
  );
});

NoChargeSection.displayName = 'NoChargeSection';

// ---------------------------------------------------------------------------
// Main PricingPage component
// ---------------------------------------------------------------------------

/**
 * Complete Pricing page component.
 * Wraps all sections in PageShell, PageEnter, and ErrorBoundary.
 * Tracks page view on mount.
 */
const PricingPage: FC = memo(function PricingPage() {
  // Track page view on mount
  useEffect(() => {
    try {
      logAndTrack('page_view', { page: '/pricing' });
    } catch (err) {
      logEvent(LogLevel.ERROR, 'Failed to track page view for /pricing', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  return (
    <ErrorBoundary fallback={<div>Something went wrong loading pricing.</div>}>
      <PageShell>
        <PageEnter>
          <article aria-label="Pricing page">
            <Hero />
            <PricingTierCard />
            <AddonTable />
            <VolumeStrip />
            <NoChargeSection />
          </article>
        </PageEnter>
      </PageShell>
    </ErrorBoundary>
  );
});

PricingPage.displayName = 'PricingPage';

export default PricingPage;