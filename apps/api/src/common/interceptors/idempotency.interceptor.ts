import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import Redis from 'ioredis';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Header the client supplies to request at-most-once semantics. */
const HEADER_NAME = 'idempotency-key';
const HEADER_MAX_LENGTH = 255;

/** How long a successful response is replayable. Matches Stripe's window. */
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24h

/** Shape we persist per (owner, route, key). */
interface CachedEntry {
  /** SHA-256 of the raw request body. Used to detect "same key, different body" reuse. */
  request_hash: string;
  /** HTTP status code that was returned originally. */
  status: number;
  /** Response body that was returned originally — re-emitted as-is on replay. */
  body: unknown;
}

interface AuthedRequest extends Request {
  user?: { id?: string };
  /** Populated by Nest because main.ts creates the app with `rawBody: true`. */
  rawBody?: Buffer;
}

/**
 * Spec-correct idempotency layer.
 *
 *   POST /v1/payouts  HTTP/1.1
 *   Idempotency-Key: 4f5d-…
 *   { "amount": 100, … }
 *
 * Behaviour:
 *  - Only intercepts POST. GET is already idempotent at the HTTP level.
 *  - If no Idempotency-Key header is present, falls straight through.
 *  - Cache is scoped by (owner, route, key) so two merchants can't collide
 *    on the same key, and the same key on different endpoints is fine.
 *  - On a hit, replays the original status + body. Cache window is 24h.
 *  - On a hit with a DIFFERENT request body, throws 422 — the integrator
 *    almost certainly has a bug (reusing a key with different params).
 *    Stripe behaves the same way.
 *  - Cache writes are fire-and-forget; a Redis blip should never fail the
 *    request itself, just degrade us to non-idempotent for the next retry.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();

    if (req.method !== 'POST') return next.handle();

    const key = sanitizeKey(req.headers[HEADER_NAME]);
    if (!key) return next.handle();

    const cacheKey = buildCacheKey(req, key);
    const requestHash = hashBody(req.rawBody);

    const cached = await this.safeGet(cacheKey);
    if (cached) {
      if (cached.request_hash !== requestHash) {
        // Client bug — surface it loudly rather than silently returning
        // a stale-and-wrong answer.
        throw new UnprocessableEntityException({
          code: 'idempotency_key_reuse',
          message:
            'Idempotency-Key was reused with a different request body. Use a new key or send the same body.',
        });
      }
      res.status(cached.status);
      return of(cached.body);
    }

    return next.handle().pipe(
      tap({
        next: (body: unknown) => {
          const entry: CachedEntry = {
            request_hash: requestHash,
            status: res.statusCode,
            body,
          };
          // Fire and forget. A Redis failure mustn't break the response.
          void this.redis
            .setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(entry))
            .catch((err: unknown) => {
              this.logger.warn(
                `idempotency cache write failed: ${stringifyErr(err)}`,
              );
            });
        },
      }),
    );
  }

  /** Reads + parses the cache entry, returning null on miss or malformed payload. */
  private async safeGet(key: string): Promise<CachedEntry | null> {
    let raw: string | null;
    try {
      raw = await this.redis.get(key);
    } catch (err) {
      // Treat Redis errors as a miss — never block legit traffic.
      this.logger.warn(`idempotency cache read failed: ${stringifyErr(err)}`);
      return null;
    }
    if (!raw) return null;

    try {
      return JSON.parse(raw) as CachedEntry;
    } catch (err) {
      this.logger.warn(`idempotency cache parse failed: ${stringifyErr(err)}`);
      return null;
    }
  }
}

/* ────────────────────────────────────────────────────────────────────── */

function sanitizeKey(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > HEADER_MAX_LENGTH) return null;
  return trimmed;
}

/**
 * Build the Redis key. Includes:
 *  - Owner — merchant id when authed, falls back to client IP for public
 *    endpoints so anonymous traffic still gets some isolation.
 *  - HTTP method + route — same key on /payouts vs /payments mustn't collide.
 *  - Client-supplied key — the actual idempotency token.
 */
function buildCacheKey(req: AuthedRequest, key: string): string {
  const merchantId = req.user?.id;
  const owner = merchantId ?? `ip:${req.ip ?? 'unknown'}`;
  const route = req.originalUrl.split('?')[0] ?? req.url;
  return `idempotency:${owner}:${req.method}:${route}:${key}`;
}

/**
 * SHA-256 of the raw request bytes. `app = NestFactory.create(..., { rawBody: true })`
 * is set in main.ts so this is always populated for POSTs with a body.
 */
function hashBody(body: Buffer | undefined): string {
  if (!body || body.length === 0) return 'empty';
  return createHash('sha256').update(body).digest('hex');
}

function stringifyErr(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
