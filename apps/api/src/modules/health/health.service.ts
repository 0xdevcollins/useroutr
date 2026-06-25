import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  IRIS_BASE_URL,
  cctpEnvFromStellarNetwork,
} from '../cctp/contracts.js';

/** Single check result — included in the /readyz response per dependency. */
export interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  /** Set when ok === false. Short reason, not a full stack. */
  error?: string;
  /** Free-form per-check extras (e.g. last_ledger for stellar). */
  meta?: Record<string, unknown>;
}

export interface ReadinessReport {
  ok: boolean;
  checks: {
    postgres: CheckResult;
    redis: CheckResult;
    stellar: CheckResult;
    circle: CheckResult;
    betterstack: CheckResult;
  };
}

const STELLAR_TIMEOUT_MS = 3_000;
const CIRCLE_TIMEOUT_MS = 3_000;
const BETTERSTACK_TIMEOUT_MS = 3_000;
const BETTERSTACK_API_URL = 'https://uptime.betterstack.com/api/v2/monitors';

/**
 * Inspects every external dependency the API needs to actually do work
 * (Postgres for state, Redis for queues + idempotency, Stellar Horizon for
 * settlement, Circle Iris for CCTP attestations) plus the BetterStack
 * watchdog that fronts our status page. Powers /readyz, which BetterStack
 * pings to decide if the status page should turn red.
 *
 * Each check is wrapped in Promise.allSettled so one slow dependency
 * doesn't masquerade as "everything is down" — the response reports per-
 * check status, and the overall `ok` is the AND of all of them.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  async checkReadiness(): Promise<ReadinessReport> {
    const [pg, redis, stellar, circle, betterstack] = await Promise.allSettled([
      this.checkPostgres(),
      this.checkRedis(),
      this.checkStellar(),
      this.checkCircle(),
      this.checkBetterStack(),
    ]);

    const checks = {
      postgres: settle(pg),
      redis: settle(redis),
      stellar: settle(stellar),
      circle: settle(circle),
      betterstack: settle(betterstack),
    };

    const ok = Object.values(checks).every((c) => c.ok);
    return { ok, checks };
  }

  private async checkPostgres(): Promise<CheckResult> {
    const start = Date.now();
    // Lightweight round-trip; uses the connection pool, not the schema.
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, latency_ms: Date.now() - start };
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    const reply = await this.redis.ping();
    return {
      ok: reply === 'PONG',
      latency_ms: Date.now() - start,
      ...(reply !== 'PONG' ? { error: `unexpected reply: ${reply}` } : {}),
    };
  }

  private async checkStellar(): Promise<CheckResult> {
    const horizonUrl =
      this.config.get<string>('STELLAR_HORIZON_URL') ??
      'https://horizon.stellar.org';

    const start = Date.now();
    const res = await fetch(`${horizonUrl}/`, {
      signal: AbortSignal.timeout(STELLAR_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    const latency_ms = Date.now() - start;

    if (!res.ok) {
      return {
        ok: false,
        latency_ms,
        error: `horizon returned ${res.status}`,
      };
    }

    // Horizon's root returns a HAL document — extract `core_latest_ledger`
    // for useful debugging context, but a 200 is enough for "ready".
    try {
      const body = (await res.json()) as { core_latest_ledger?: number };
      return {
        ok: true,
        latency_ms,
        meta: { latest_ledger: body.core_latest_ledger },
      };
    } catch {
      // Body parse failure shouldn't fail the readiness check.
      return { ok: true, latency_ms };
    }
  }

  /**
   * Circle Iris API reachability — the attestation service that signs
   * CCTP V2 burns. If this is down, cross-chain settlements stall until
   * it recovers, so it's a first-class readiness signal alongside
   * Stellar/Postgres/Redis. Pings the root of iris-api (or its sandbox
   * counterpart on testnet) with a 3s timeout.
   */
  private async checkCircle(): Promise<CheckResult> {
    const env = cctpEnvFromStellarNetwork(
      this.config.get<string>('STELLAR_NETWORK'),
    );
    const base = IRIS_BASE_URL[env];

    const start = Date.now();
    const res = await fetch(`${base}/`, {
      signal: AbortSignal.timeout(CIRCLE_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    const latency_ms = Date.now() - start;

    // Iris returns 200/404 on root depending on version — both prove the
    // service is reachable. A 5xx or network error is the failure mode
    // we actually care about.
    if (res.status >= 500) {
      return {
        ok: false,
        latency_ms,
        error: `iris returned ${res.status}`,
      };
    }

    return {
      ok: true,
      latency_ms,
      meta: { env },
    };
  }

  /**
   * Confirms the BetterStack watchdog is itself alive — the API key works
   * and at least one un-paused monitor exists. Catches the silent failure
   * mode where nobody is actually watching us (key revoked, monitors all
   * paused, account suspended) and we'd never know because no probes fire.
   *
   * Intentionally does NOT fail on individual monitors being down: one of
   * those monitors is `/readyz` itself, so reflecting their state here
   * would create a feedback loop. We only assert that monitoring is wired.
   */
  private async checkBetterStack(): Promise<CheckResult> {
    const apiKey = this.config.get<string>('BETTERSTACK_API_KEY');
    if (!apiKey) {
      return { ok: false, error: 'BETTERSTACK_API_KEY not configured' };
    }

    const start = Date.now();
    const res = await fetch(BETTERSTACK_API_URL, {
      signal: AbortSignal.timeout(BETTERSTACK_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });
    const latency_ms = Date.now() - start;

    if (!res.ok) {
      return {
        ok: false,
        latency_ms,
        error: `betterstack returned ${res.status}`,
      };
    }

    try {
      const body = (await res.json()) as {
        data?: Array<{ attributes?: { paused?: boolean } }>;
      };
      const monitors = body.data ?? [];
      const active = monitors.filter((m) => m.attributes?.paused !== true);

      if (active.length === 0) {
        return {
          ok: false,
          latency_ms,
          error: 'no active monitors configured',
          meta: { total: monitors.length, active: 0 },
        };
      }

      return {
        ok: true,
        latency_ms,
        meta: { total: monitors.length, active: active.length },
      };
    } catch {
      // Reachable + authorized is enough; body shape changes shouldn't
      // turn a green watchdog red.
      return { ok: true, latency_ms };
    }
  }
}

/**
 * Promise.allSettled returns a result per task. Map it into our
 * uniform `CheckResult` shape and stringify rejection reasons.
 */
function settle(
  result: PromiseSettledResult<CheckResult>,
): CheckResult {
  if (result.status === 'fulfilled') return result.value;
  const reason = result.reason;
  const error =
    reason instanceof Error ? reason.message : String(reason ?? 'unknown error');
  return { ok: false, error };
}
