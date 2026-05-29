tsx
import type { ErrorInfo, ReactNode } from 'react';
import React, { memo, useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { PageShell } from '@/components/v2/PageShell';
import { PageEnter } from '@/components/v2/PageEnter';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { LogLevel, log } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types – read‑only contracts for all data structures
// ---------------------------------------------------------------------------

/** Represents a single pricing tier. */
interface PricingTier {
  readonly name: string;
  readonly rate: string;
  readonly dropText: string;
  readonly features: readonly string[];
  readonly cta: string;
}

/** Represents an add‑on cost row. */
interface AddonRow {
  readonly feature: string;
  readonly cost: string;
}

/** Represents a volume‑based pricing tier. */
interface VolumeTier {
  readonly threshold: string;
  readonly rate: string;
  readonly cta?: string;
  readonly ctaLink?: string;
}

// ---------------------------------------------------------------------------
// Constants – deeply frozen to prevent mutation at runtime
// ---------------------------------------------------------------------------

/** Main pricing tier definition. */
const TIER: PricingTier = Object.freeze({
  name: 'Starter',
  rate: '0.5% per transaction',
  dropText: '↓ drops to 0.35% above $50,000 / month',
  features: Object.freeze([
    'All payment methods (card, bank, crypto, mobile money)',
    'Hosted checkout + pay-by-link + invoices',
    'Global payouts to 174 countries',
    'Managed Stellar settlement wallet',
    'Webhooks + SDKs + sandbox',
    'Standard support (email, 1 business day)',
  ]),
  cta: 'Start building →',
});

/** Add‑on cost table rows. */
const ADDONS: readonly AddonRow[] = Object.freeze([
  Object.freeze({ feature: 'Card payments (Stripe)', cost: 'network fee pass-through, no markup' }),
  Object.freeze({ feature: 'Bank transfers (ACH, SEPA)', cost: 'network fee pass-through, no markup' }),
  Object.freeze({ feature: 'Crypto payments (CCTP V2)', cost: 'Circle protocol fee pass-through' }),
  Object.freeze({ feature: 'Mobile money (M-Pesa, MTN)', cost: 'rail fee pass-through' }),
  Object.freeze({ feature: 'Payouts', cost: 'included in 0.5%' }),
  Object.freeze({ feature: 'FX conversion', cost: 'mid-market rate + 30 bps' }),
  Object.freeze({ feature: 'Sandbox', cost: 'free, unlimited' }),
  Object.freeze({ feature: 'Webhook retries', cost: 'included, exhaustion after 10 attempts' }),
]);

/** Volume discount tiers. */
const VOLUME_TIERS: readonly VolumeTier[] = Object.freeze([
  Object.freeze({ threshold: 'Above $50,000 monthly volume', rate: '0.35%' }),
  Object.freeze({ threshold: 'Above $500,000 monthly volume', rate: '0.30%' }),
  Object.freeze({
    threshold: 'Above $5,000,000 monthly volume',
    rate: "let's talk",
    cta: 'Contact sales →',
    ctaLink: '/contact-sales',
  }),
]);

/** Items we do not charge for. */
const NOCHARGE_ITEMS: readonly string[] = Object.freeze([
  'Setup fees',
  'Monthly minimums',
  'Hidden FX spreads',
  '"Express settlement" premiums',
  'Revenue share',
]);

// ---------------------------------------------------------------------------
// Input validation (dev‑only)
// ---------------------------------------------------------------------------

/**
 * Validates that all constant data arrays are non‑empty.
 * Logs a warning in development if any is empty.
 */
function validateConstants(): void {
  if (process.env.NODE_ENV === 'development') {
    if (!TIER.features.length) {
      log(LogLevel.WARN, 'Pricing: TIER.features is empty');
    }
    if (!ADDONS.length) {
      log(LogLevel.WARN, 'Pricing: ADDONS is empty');
    }
    if (!VOLUME_TIERS.length) {
      log(LogLevel.WARN, 'Pricing: VOLUME_TIERS is empty');
    }
    if (!NOCHARGE_ITEMS.length) {
      log(LogLevel.WARN, 'Pricing: NOCHARGE_ITEMS is empty');
    }
  }
}

// Run validation once at module load.
validateConstants();

// ---------------------------------------------------------------------------
// Error boundary fallback for the pricing page
// ---------------------------------------------------------------------------

/**
 * Rendered when an error is caught by the error boundary.
 * Displays a user‑friendly message and logs the error.
 */
const PricingErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => {
  useEffect(() => {
    log(LogLevel.ERROR, 'Pricing page crashed', { error: error.message, stack: error.stack });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" role="alert">
      <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
      <p className="mt-2 text-muted-foreground">
        The pricing page encountered an unexpected error. Please try refreshing.
      </p>
      <Button className="mt-6" variant="default" onClick={resetErrorBoundary}>
        Reload page
      </Button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub‑components (all memoised for performance)
// ---------------------------------------------------------------------------

/** Accent gradient ribbon at the top of the page. */
const AccentRibbon: React.FC = memo(function AccentRibbon() {
  return (
    <div
      className="h-1 w-full bg-gradient-to-r from-accent via-accent/70 to-accent/30"
      aria-hidden="true"
    />
  );
});
AccentRibbon.displayName = 'AccentRibbon';

/** Hero section with main heading and leading copy. */
const HeroSection: React.FC = memo(function HeroSection() {
  return (
    <section className="py-20 text-center">
      <h1 className="text-5xl font-bold text-foreground md:text-6xl">
        Plain pricing. No revenue share.
      </h1>
      <p className="mt-6 text-xl text-muted-foreground italic">
        What you&apos;d hope a payment processor would do.
      </p>
      <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
        One per-transaction fee, the same on every rail. Network costs pass
        through at cost — we never mark up the underlying chain or fiat rail.
      </p>
    </section>
  );
});
HeroSection.displayName = 'HeroSection';

/** Single pricing tier card with feature list and CTA. */
const PricingCard: React.FC = memo(function PricingCard() {
  // The constant is validated at module load, but we still guard for safety.
  if (!TIER.features.length) {
    log(LogLevel.ERROR, 'PricingCard: TIER.features is empty – rendering fallback');
    return null;
  }

  /**
   * Handles click on the CTA button.
   * Logs the event for analytics purposes.
   */
  const handleCtaClick = useCallback(() => {
    log(LogLevel.INFO, 'PricingCard CTA clicked', { tier: TIER.name });
    // Navigation or modal logic would be handled by the Button's routing
  }, []);

  return (
    <section className="max-w-md mx-auto border border-border rounded-xl p-8" aria-labelledby="tier-heading">
      <h2 id="tier-heading" className="text-2xl font-semibold text-foreground">{TIER.name}</h2>
      <p className="mt-2 text-3xl font-bold text-accent">{TIER.rate}</p>
      <p className="mt-1 text-sm text-muted-foreground">{TIER.dropText}</p>
      <hr className="my-6 border-divider" />
      <h3 className="sr-only">What&apos;s included</h3>
      <ul className="space-y-3">
        {TIER.features.map((feature) => (
          <li key={feature} className="flex items-start text-sm">
            <span className="mr-2 text-accent" aria-hidden="true">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-8 w-full"
        variant="default"
        size="lg"
        onClick={handleCtaClick}
        aria-label={`Start building with ${TIER.name} plan`}
      >
        {TIER.cta}
      </Button>
    </section>
  );
});
PricingCard.displayName = 'PricingCard';

/** Add‑on cost table. */
const AddonTable: React.FC = memo(function AddonTable() {
  if (!ADDONS.length) {
    log(LogLevel.WARN, 'AddonTable: no addon data');
    return null;
  }

  return (
    <section className="my-12">
      <h3 className="text-lg font-medium text-foreground mb-4">Add‑on costs</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" aria-label="Add-on pricing table">
          <thead>
            <tr className="border-b border-divider text-left">
              <th className="py-2 pr-4 font-medium text-muted-foreground">Feature</th>
              <th className="py-2 font-medium text-muted-foreground">Cost</th>
            </tr>
          </thead>
          <tbody>
            {ADDONS.map((row) => (
              <tr key={row.feature} className="border-b border-divider/50">
                <td className="py-2 pr-4">{row.feature}</td>
                <td className="py-2">{row.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});
AddonTable.displayName = 'AddonTable';

/** Volume discount strip with optional CTA. */
const VolumeStrip: React.FC = memo(function VolumeStrip() {
  if (!VOLUME_TIERS.length) {
    log(LogLevel.WARN, 'VolumeStrip: no volume tiers');
    return null;
  }

  return (
    <section className="my-12 space-y-4">
      <h3 className="text-lg font-medium text-foreground">Volume pricing</h3>
      {VOLUME_TIERS.map((tier) => (
        <div
          key={tier.threshold}
          className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-divider/50"
        >
          <span className="text-sm text-muted-foreground">{tier.threshold}:</span>
          <span className="font-semibold text-accent text-sm">
            {tier.rate}
            {tier.cta && (
              <Button
                variant="link"
                size="sm"
                className="ml-2"
                asChild
              >
                <a href={tier.ctaLink ?? '#'} target="_self" rel="noopener noreferrer">
                  {tier.cta}
                </a>
              </Button>
            )}
          </span>
        </div>
      ))}
    </section>
  );
});
VolumeStrip.displayName = 'VolumeStrip';

/** List of items we don't charge for. */
const NoChargeList: React.FC = memo(function NoChargeList() {
  if (!NOCHARGE_ITEMS.length) {
    log(LogLevel.WARN, 'NoChargeList: no items');
    return null;
  }

  return (
    <section className="my-12">
      <h3 className="text-lg font-medium text-foreground mb-4">What we don&apos;t charge for</h3>
      <ul className="space-y-2">
        {NOCHARGE_ITEMS.map((item) => (
          <li key={item} className="flex items-start text-sm">
            <span className="mr-2 text-green-500" aria-hidden="true">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
});
NoChargeList.displayName = 'NoChargeList';

/** Divider hairline rule. */
const Hairline: React.FC = memo(function Hairline() {
  return <hr className="border-divider" aria-hidden="true" />;
});
Hairline.displayName = 'Hairline';

// ---------------------------------------------------------------------------
// Inner content component (wrapped in error boundary)
// ---------------------------------------------------------------------------

/**
 * Actual pricing page content.
 * This component is isolated so the error boundary can catch rendering errors.
 */
const PricingContent: React.FC = memo(function PricingContent() {
  // Try-catch around rendering to log any unexpected errors
  try {
    return (
      <>
        <AccentRibbon />
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <HeroSection />
          <Hairline />
          <div className="my-12">
            <PricingCard />
          </div>
          <Hairline />
          <AddonTable />
          <Hairline />
          <VolumeStrip />
          <Hairline />
          <NoChargeList />
        </div>
      </>
    );
  } catch (error) {
    // Log and re-throw for error boundary to catch
    log(LogLevel.ERROR, 'Unexpected error in PricingContent', { error });
    throw error;
  }
});
PricingContent.displayName = 'PricingContent';

// ---------------------------------------------------------------------------
// Main pricing page component
// ---------------------------------------------------------------------------

/**
 * Pricing page – renders the full pricing information using `PageShell` and `PageEnter`.
 *
 * @remarks
 * This component is wrapped with an `ErrorBoundary` to catch rendering errors
 * and display a fallback UI. All data constants are validated at module load.
 */
const Pricing: React.FC = memo(function Pricing() {
  const [hasError, setHasError] = useState(false);

  /**
   * Resets the error boundary state, effectively reloading the content.
   */
  const handleReset = useCallback(() => {
    setHasError(false);
    log(LogLevel.INFO, 'Pricing error boundary reset triggered');
  }, []);

  // If an error has occurred, show fallback directly (redundant safety)
  if (hasError) {
    return (
      <PageShell>
        <PageEnter>
          <PricingErrorFallback
            error={new Error('Unknown rendering error')}
            resetErrorBoundary={handleReset}
          />
        </PageEnter>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageEnter>
        <ErrorBoundary
          fallback={(error: Error, reset: () => void) => (
            <PricingErrorFallback error={error} resetErrorBoundary={reset} />
          )}
          onError={(error: Error, errorInfo: ErrorInfo) => {
            log(LogLevel.ERROR, 'Pricing ErrorBoundary caught error', {
              error: error.message,
              componentStack: errorInfo.componentStack,
            });
          }}
        >
          <PricingContent />
        </ErrorBoundary>
      </PageEnter>
    </PageShell>
  );
});
Pricing.displayName = 'Pricing';

export default Pricing;