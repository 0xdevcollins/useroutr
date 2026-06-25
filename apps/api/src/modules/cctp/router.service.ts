import { Injectable } from '@nestjs/common';
import { isEnabled as isCctpV2Enabled } from './domains.js';

/**
 * Where each quote ends up routing. CCTP-V2 is the only live cross-chain
 * path post-migration; `stellar_native` covers same-chain Stellar swaps
 * via the DEX. The other values are kept on the union so legacy quote
 * rows (rows written before PR C) still type-check until they roll off.
 */
export type RouteProvider =
  | 'stellar_native'
  | 'cctp_v2'
  | 'cctp'
  | 'wormhole'
  | 'layerswap';

export interface RouteDecision {
  fromChain: string;
  toChain: string;
  asset: string;
  provider: RouteProvider;
  /** Customer-facing time estimate. Don't tighten without a Circle SLA. */
  estimatedTimeMs: number;
  /** Platform fee (basis points). Network fees are quoted separately. */
  estimatedFeeBps: number;
}

/**
 * CCTP V2 Fast Transfer settles in 8–20s end-to-end (Circle's published
 * range). We pick 12s as the customer-facing estimate — middle of the
 * range and accurate for Stellar↔EVM pairs.
 */
const CCTP_V2_ESTIMATED_TIME_MS = 12_000;

/**
 * The forwarding fee is variable (Circle quotes per-route at burn time)
 * so the router surfaces 0 bps as a baseline. Precise per-transfer fee
 * is locked from Circle's fee-estimate API by `ForwarderService` at
 * burn time, *not* at quote time.
 */
const CCTP_V2_ESTIMATED_FEE_BPS = 0;

/**
 * Picks a route for a `(from, to, asset)` tuple. Pure decision logic —
 * no IO, no contracts injected. The caller (quotes / payments) takes
 * the decision and dispatches to the right executor:
 *
 *  - `cctp_v2`       → `CctpService.prepareBurn(...)` / observe
 *  - `stellar_native` → `StellarService.pathPayment(...)` (existing)
 *  - any legacy value → not callable post-PR D; surfacing one means the
 *                       chain pair isn't enabled in `cctp/domains.ts`,
 *                       so flip the entry's `enabled` flag to fix.
 */
@Injectable()
export class RouterService {
  findRoute(from: string, to: string, asset: string): RouteDecision {
    // Same-chain Stellar — no bridge, just a DEX path payment.
    if (from === 'stellar' && to === 'stellar') {
      return {
        fromChain: from,
        toChain: to,
        asset,
        provider: 'stellar_native',
        estimatedTimeMs: 5_000,
        estimatedFeeBps: 0,
      };
    }

    // CCTP V2 wins for any USDC route between enabled chains. This is
    // the entire intentional surface area after the migration.
    if (
      asset === 'USDC' &&
      isCctpV2Enabled(from) &&
      isCctpV2Enabled(to) &&
      from !== to
    ) {
      return {
        fromChain: from,
        toChain: to,
        asset,
        provider: 'cctp_v2',
        estimatedTimeMs: CCTP_V2_ESTIMATED_TIME_MS,
        estimatedFeeBps: CCTP_V2_ESTIMATED_FEE_BPS,
      };
    }

    // Anything else surfaces a legacy provider name. Post-PR-D, no
    // executor exists for these so the caller will fail at dispatch
    // time — an intentional loud signal that we hit an unsupported
    // route (non-USDC cross-chain, or a chain we haven't enabled).
    if (from === 'starknet' || to === 'starknet') {
      return {
        fromChain: from,
        toChain: to,
        asset,
        provider: 'layerswap',
        estimatedTimeMs: 120_000,
        estimatedFeeBps: 10,
      };
    }

    return {
      fromChain: from,
      toChain: to,
      asset,
      provider: 'wormhole',
      estimatedTimeMs: 60_000,
      estimatedFeeBps: 5,
    };
  }
}
