import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cctpEnvFromStellarNetwork,
  IRIS_BASE_URL,
  type CctpEnv,
} from './contracts.js';

/** Fast Transfer. Circle charges for it. */
export const FINALITY_FAST = 1000;
/** Hard finality. Free, but minutes rather than seconds. */
export const FINALITY_STANDARD = 2000;

const REQUEST_TIMEOUT_MS = 8000;

/** Circle quotes its minimum in basis points of the burn amount. */
const BPS_DENOMINATOR = 10_000n;

interface IrisFeeEntry {
  finalityThreshold?: number;
  minimumFee?: number;
}

/**
 * What a Fast Transfer costs, according to Circle.
 *
 * This exists because a burn that asks for Fast Transfer while offering
 * `maxFee: 0` is not rejected — it is silently demoted. Circle keeps the
 * message at `pending_confirmations` with `delayReason: insufficient_fee` and
 * waits for hard finality instead, so a payment advertised as "8–20 seconds"
 * quietly becomes a fifteen-minute one, with nothing in our own logs to say so.
 *
 * The fee is small (1 bp on Ethereum → Stellar at the time of writing, i.e. one
 * subunit on a one-cent payment) but it has to be non-zero and it has to be
 * asked for.
 */
@Injectable()
export class BurnFeeService {
  private readonly logger = new Logger(BurnFeeService.name);
  private readonly env: CctpEnv;

  /** Cached per source→destination pair; Circle's fees move rarely. */
  private readonly cache = new Map<string, { bps: number; at: number }>();
  private static readonly TTL_MS = 5 * 60 * 1000;

  constructor(private readonly config: ConfigService) {
    this.env = cctpEnvFromStellarNetwork(
      this.config.get<string>('STELLAR_NETWORK'),
    );
  }

  /**
   * Minimum fee in basis points for `finalityThreshold` on this route, or
   * `null` if Circle could not be reached or quotes no such tier.
   *
   * Null is a real answer, not an error: the caller's job is to fall back to
   * standard finality rather than send a burn that will be demoted anyway.
   */
  async minimumFeeBps(
    sourceDomain: number,
    destinationDomain: number,
    finalityThreshold: number = FINALITY_FAST,
  ): Promise<number | null> {
    const key = `${sourceDomain}:${destinationDomain}:${finalityThreshold}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < BurnFeeService.TTL_MS) return hit.bps;

    const url = `${IRIS_BASE_URL[this.env]}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        this.logger.warn(
          `Circle fee lookup ${sourceDomain}→${destinationDomain} returned ${res.status}; falling back to standard finality.`,
        );
        return null;
      }

      const rows = (await res.json()) as IrisFeeEntry[];
      const row = rows.find((r) => r.finalityThreshold === finalityThreshold);
      if (!row || typeof row.minimumFee !== 'number') {
        this.logger.warn(
          `Circle quotes no tier ${finalityThreshold} for ${sourceDomain}→${destinationDomain}; falling back to standard finality.`,
        );
        return null;
      }

      this.cache.set(key, { bps: row.minimumFee, at: Date.now() });
      return row.minimumFee;
    } catch (err) {
      this.logger.warn(
        `Circle fee lookup failed for ${sourceDomain}→${destinationDomain}: ${
          err instanceof Error ? err.message : String(err)
        }. Falling back to standard finality.`,
      );
      return null;
    }
  }

  /**
   * Converts Circle's basis points into a `maxFee` for `amount`.
   *
   * Rounds up, and never returns 0 for a non-zero rate: 1 bp of a one-cent
   * payment is 0.0001 USDC, which truncates to nothing in 6-decimal subunits —
   * and a maxFee of 0 is exactly the "insufficient fee" the caller is trying to
   * avoid. Paying one subunit more than strictly required beats being demoted
   * to a fifteen-minute settlement over a rounding error.
   */
  maxFeeFor(amountSubunits: bigint, bps: number): bigint {
    if (bps <= 0) return 0n;
    const numerator = amountSubunits * BigInt(bps);
    const rounded =
      numerator / BPS_DENOMINATOR + (numerator % BPS_DENOMINATOR ? 1n : 0n);
    return rounded > 0n ? rounded : 1n;
  }
}
