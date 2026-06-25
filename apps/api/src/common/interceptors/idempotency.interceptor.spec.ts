import {
  CallHandler,
  ExecutionContext,
  UnprocessableEntityException,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { firstValueFrom, of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/* ── Tiny test doubles ───────────────────────────────────────────────── */

interface FakeRedis {
  store: Map<string, string>;
  get: jest.Mock;
  setex: jest.Mock;
  failGet?: boolean;
}

function makeRedis(): FakeRedis {
  const store = new Map<string, string>();
  const fake: FakeRedis = {
    store,
    get: jest.fn(async (key: string) => {
      if (fake.failGet) throw new Error('redis down');
      return store.get(key) ?? null;
    }),
    setex: jest.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
  };
  return fake;
}

interface MockReq {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
  originalUrl: string;
  url: string;
  ip?: string;
  user?: { id?: string };
}

interface MockRes {
  statusCode: number;
  status: jest.Mock;
}

function makeContext(
  req: MockReq,
  res: MockRes = { statusCode: 200, status: jest.fn() },
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(returnValue: unknown): CallHandler {
  return {
    handle: jest.fn(() => of(returnValue)),
  };
}

/* ── Tests ────────────────────────────────────────────────────────────── */

describe('IdempotencyInterceptor', () => {
  let redis: FakeRedis;
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    redis = makeRedis();
    interceptor = new IdempotencyInterceptor(redis as unknown as Redis);
  });

  it('passes through non-POST requests untouched', async () => {
    const handler = makeHandler({ ok: true });
    const ctx = makeContext({
      method: 'GET',
      headers: { 'idempotency-key': 'abc-123' },
      originalUrl: '/v1/anything',
      url: '/v1/anything',
    });

    const result = await firstValueFrom(
      (await interceptor.intercept(ctx, handler)) as ReturnType<
        CallHandler['handle']
      >,
    );

    expect(result).toEqual({ ok: true });
    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('passes through POSTs that omit the Idempotency-Key header', async () => {
    const handler = makeHandler({ id: 'po_1' });
    const ctx = makeContext({
      method: 'POST',
      headers: {},
      originalUrl: '/v1/payouts',
      url: '/v1/payouts',
    });

    const result = await firstValueFrom(
      (await interceptor.intercept(ctx, handler)) as ReturnType<
        CallHandler['handle']
      >,
    );

    expect(result).toEqual({ id: 'po_1' });
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('caches the first response and replays it on retry with same body', async () => {
    const body = Buffer.from(JSON.stringify({ amount: 100 }));
    const firstHandler = makeHandler({ id: 'po_first', status: 'pending' });
    const ctx1 = makeContext({
      method: 'POST',
      headers: { 'idempotency-key': 'key-A' },
      rawBody: body,
      originalUrl: '/v1/payouts',
      url: '/v1/payouts',
      user: { id: 'merchant_1' },
    });

    await firstValueFrom(
      (await interceptor.intercept(ctx1, firstHandler)) as ReturnType<
        CallHandler['handle']
      >,
    );
    expect(firstHandler.handle).toHaveBeenCalledTimes(1);
    expect(redis.setex).toHaveBeenCalledTimes(1);

    // Second call — same key, same body, but a fresh handler that would
    // return something different if reached. We expect the cached value
    // to come back, and the handler to NEVER be called.
    const secondHandler = makeHandler({ id: 'po_second' });
    const ctx2 = makeContext({
      method: 'POST',
      headers: { 'idempotency-key': 'key-A' },
      rawBody: body,
      originalUrl: '/v1/payouts',
      url: '/v1/payouts',
      user: { id: 'merchant_1' },
    });

    const replay = await firstValueFrom(
      (await interceptor.intercept(ctx2, secondHandler)) as ReturnType<
        CallHandler['handle']
      >,
    );

    expect(replay).toEqual({ id: 'po_first', status: 'pending' });
    expect(secondHandler.handle).not.toHaveBeenCalled();
  });

  it('rejects with 422 when the same key is reused with a different body', async () => {
    const ctx1 = makeContext({
      method: 'POST',
      headers: { 'idempotency-key': 'key-B' },
      rawBody: Buffer.from(JSON.stringify({ amount: 100 })),
      originalUrl: '/v1/payouts',
      url: '/v1/payouts',
      user: { id: 'merchant_1' },
    });
    await firstValueFrom(
      (await interceptor.intercept(
        ctx1,
        makeHandler({ id: 'po_1' }),
      )) as ReturnType<CallHandler['handle']>,
    );

    const ctx2 = makeContext({
      method: 'POST',
      headers: { 'idempotency-key': 'key-B' },
      rawBody: Buffer.from(JSON.stringify({ amount: 999 })), // mismatched
      originalUrl: '/v1/payouts',
      url: '/v1/payouts',
      user: { id: 'merchant_1' },
    });

    await expect(
      interceptor.intercept(ctx2, makeHandler({ id: 'po_other' })),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('scopes cache by merchant id so two merchants do not collide', async () => {
    const body = Buffer.from(JSON.stringify({ amount: 100 }));

    await firstValueFrom(
      (await interceptor.intercept(
        makeContext({
          method: 'POST',
          headers: { 'idempotency-key': 'shared-key' },
          rawBody: body,
          originalUrl: '/v1/payouts',
          url: '/v1/payouts',
          user: { id: 'merchant_A' },
        }),
        makeHandler({ id: 'A1' }),
      )) as ReturnType<CallHandler['handle']>,
    );

    const merchantBHandler = makeHandler({ id: 'B1' });
    const result = await firstValueFrom(
      (await interceptor.intercept(
        makeContext({
          method: 'POST',
          headers: { 'idempotency-key': 'shared-key' }, // identical key
          rawBody: body,
          originalUrl: '/v1/payouts',
          url: '/v1/payouts',
          user: { id: 'merchant_B' },
        }),
        merchantBHandler,
      )) as ReturnType<CallHandler['handle']>,
    );

    // merchant B's call should not be served from merchant A's cache —
    // handler must run.
    expect(merchantBHandler.handle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'B1' });
  });

  it('scopes cache by route so same key on different endpoints does not collide', async () => {
    const body = Buffer.from(JSON.stringify({ amount: 100 }));

    await firstValueFrom(
      (await interceptor.intercept(
        makeContext({
          method: 'POST',
          headers: { 'idempotency-key': 'k' },
          rawBody: body,
          originalUrl: '/v1/payouts',
          url: '/v1/payouts',
          user: { id: 'm1' },
        }),
        makeHandler({ id: 'payout_1' }),
      )) as ReturnType<CallHandler['handle']>,
    );

    const paymentHandler = makeHandler({ id: 'payment_1' });
    const result = await firstValueFrom(
      (await interceptor.intercept(
        makeContext({
          method: 'POST',
          headers: { 'idempotency-key': 'k' },
          rawBody: body,
          originalUrl: '/v1/payments', // different route, same key
          url: '/v1/payments',
          user: { id: 'm1' },
        }),
        paymentHandler,
      )) as ReturnType<CallHandler['handle']>,
    );

    expect(paymentHandler.handle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'payment_1' });
  });

  it('falls back to IP scoping when there is no authenticated merchant', async () => {
    const body = Buffer.from(JSON.stringify({ amount: 50 }));
    const handler = makeHandler({ id: 'pub_1' });

    await firstValueFrom(
      (await interceptor.intercept(
        makeContext({
          method: 'POST',
          headers: { 'idempotency-key': 'pub-k' },
          rawBody: body,
          originalUrl: '/v1/public/links/pay',
          url: '/v1/public/links/pay',
          ip: '203.0.113.7',
        }),
        handler,
      )) as ReturnType<CallHandler['handle']>,
    );

    // Confirm the cache key used the IP fallback prefix.
    const writtenKey = redis.setex.mock.calls[0][0] as string;
    expect(writtenKey).toContain('ip:203.0.113.7');
  });

  it('treats Redis failures as a cache miss rather than failing the request', async () => {
    redis.failGet = true;
    const handler = makeHandler({ id: 'po_1' });

    const result = await firstValueFrom(
      (await interceptor.intercept(
        makeContext({
          method: 'POST',
          headers: { 'idempotency-key': 'k-failover' },
          rawBody: Buffer.from('{}'),
          originalUrl: '/v1/payouts',
          url: '/v1/payouts',
          user: { id: 'm1' },
        }),
        handler,
      )) as ReturnType<CallHandler['handle']>,
    );

    expect(handler.handle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 'po_1' });
  });
});
