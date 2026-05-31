import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  cctpEnvFromStellarNetwork,
  IRIS_BASE_URL,
  type CctpEnv,
} from './contracts.js';
import type { AttestationResponse } from './types.js';

/**
 * Default per-attempt timeout. Iris is usually fast (<200ms) — anything
 * past this is a network problem and we should bail rather than block
 * the worker.
 */
const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Maximum number of poll attempts before we give up on an attestation.
 * Standard Transfer on Ethereum L1 takes ~15 min so we need at least 90
 * polls at 10s intervals. Fast Transfer settles in <30s — most cases
 * resolve in 2–4 polls.
 */
const DEFAULT_MAX_ATTEMPTS = 120;

/**
 * Backoff schedule (ms). Tighter at first (Fast Transfer settles quickly)
 * then widens out so we don't hammer iris waiting for L1 hard finality.
 */
const BACKOFF_MS = [
  1_000, 2_000, 3_000, 5_000, 8_000, 10_000, 10_000, 15_000, 15_000, 30_000,
];

interface PollOptions {
  /** Total attempts before giving up. */
  maxAttempts?: number;
  /** AbortSignal to cancel the whole poll loop (eg. shutdown). */
  signal?: AbortSignal;
}

/**
 * Talks to Circle's Iris API to fetch attestations for CCTP V2 burns.
 *
 *   - `fetch(domain, txHash)`   — single request, returns whatever Iris has
 *   - `pollUntilReady(...)`     — long-running, returns when status === 'complete'
 *                                  or `failed`, or throws on timeout / abort
 *
 * Public methods are intentionally narrow — domain logic (mint dispatch,
 * idempotency, persistence) lives in the high-level CctpService and the
 * relay worker.
 *
 * Iris caveats baked in:
 *  - Rate limit is 35 req/s globally for our account. The poll loop is
 *    serial per nonce; many nonces in flight will need a Redis-backed
 *    token bucket. Out of scope for PR B; we'll add it in PR C if
 *    concurrent volumes need it.
 *  - V2 path is `/v2/messages/{sourceDomain}?transactionHash=…`. V1 path
 *    `/attestations/…` is rejected by V2 contracts and we don't call it.
 */
@Injectable()
export class AttestationService {
  private readonly logger = new Logger(AttestationService.name);
  private readonly env: CctpEnv;

  constructor(private readonly config: ConfigService) {
    this.env = cctpEnvFromStellarNetwork(
      this.config.get<string>('STELLAR_NETWORK'),
    );
    this.logger.log(
      `Attestation service ready: ${this.env} (${IRIS_BASE_URL[this.env]})`,
    );
  }

  /**
   * One-shot fetch. Returns the latest known attestation state for the
   * burn at `txHash` on chain `sourceDomain`. Never throws on the
   * "still pending" case — that's a normal response shape.
   *
   * Throws only on:
   *  - 4xx that isn't 404 (config/auth error — caller should surface)
   *  - 5xx (Iris outage — caller decides retry policy)
   *  - Network error / timeout
   */
  async fetch(
    sourceDomain: number,
    txHash: string,
  ): Promise<AttestationResponse> {
    const url = `${IRIS_BASE_URL[this.env]}/v2/messages/${sourceDomain}?transactionHash=${txHash}`;

    const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);

    if (res.status === 404) {
      // Burn tx not yet observed by Iris — treat as pending.
      return { status: 'pending_confirmations' };
    }
    if (!res.ok) {
      const body = await safeText(res);
      throw new Error(`iris-api returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const raw = (await res.json()) as IrisResponse;
    return normalizeIrisResponse(raw);
  }

  /**
   * Poll until the attestation settles or we hit max attempts. Throws on
   * abort signal trip, timeout exhaustion, or any non-pending Iris error.
   *
   * Returned `AttestationResponse` is always `complete` or `failed` on
   * success — never `pending_confirmations`.
   */
  async pollUntilReady(
    sourceDomain: number,
    txHash: string,
    opts: PollOptions = {},
  ): Promise<AttestationResponse> {
    const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (opts.signal?.aborted) {
        throw new AttestationAborted();
      }

      let result: AttestationResponse;
      try {
        result = await this.fetch(sourceDomain, txHash);
      } catch (err) {
        // Network/Iris error: log + back off, don't kill the poll loop.
        this.logger.warn(
          `attestation fetch attempt ${attempt + 1} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        await sleep(backoff(attempt), opts.signal);
        continue;
      }

      if (result.status === 'complete' || result.status === 'failed') {
        return result;
      }

      await sleep(backoff(attempt), opts.signal);
    }

    throw new AttestationTimeout(maxAttempts);
  }
}

/* ─── helpers ──────────────────────────────────────────────────────────── */

interface IrisResponse {
  messages?: Array<{
    status?: string;
    message?: string;
    attestation?: string;
    forwardTxHash?: string;
    errorMessage?: string;
  }>;
}

/**
 * Iris v2 returns `{ messages: [{...}] }`. We pluck the first entry and
 * coerce its `status` into our enum. Unknown statuses become 'pending'
 * — defensive: prefer over-polling to a bad cast.
 */
function normalizeIrisResponse(raw: IrisResponse): AttestationResponse {
  const msg = raw.messages?.[0];
  if (!msg) return { status: 'pending_confirmations' };

  const status = msg.status?.toLowerCase();

  if (status === 'complete') {
    return {
      status: 'complete',
      message: msg.message,
      attestation: msg.attestation,
      forwardTxHash: msg.forwardTxHash,
    };
  }
  if (status === 'failed' || msg.errorMessage) {
    return {
      status: 'failed',
      error: msg.errorMessage ?? 'attestation failed (no detail from Iris)',
    };
  }
  return { status: 'pending_confirmations' };
}

function backoff(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new AttestationAborted());
      },
      { once: true },
    );
  });
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json' },
  });
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/* ─── errors ──────────────────────────────────────────────────────────── */

export class AttestationTimeout extends Error {
  constructor(attempts: number) {
    super(`attestation did not settle after ${attempts} poll attempts`);
    this.name = 'AttestationTimeout';
  }
}

export class AttestationAborted extends Error {
  constructor() {
    super('attestation poll was aborted');
    this.name = 'AttestationAborted';
  }
}
