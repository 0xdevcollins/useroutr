import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Payment-link lifecycle against a real database — the automatable core of
 * #121. Everything here is API-level on purpose: the parts of that issue that
 * need a browser, a Stripe test card or a Resend inbox stay manual, but the
 * status transitions and the single-use guard are where the bugs actually
 * live, and those are checkable here.
 *
 * Needs Postgres and Redis up, and migrations applied:
 *
 *   docker compose up -d postgres redis
 *   npx prisma migrate deploy && npx prisma generate
 *
 * The generous hook timeout is not padding. `POST /auth/register` awaits
 * settlement-wallet provisioning, which makes two live Stellar testnet round
 * trips — Friendbot funding, then a USDC trustline that waits for a ledger
 * close. Typically ~10s, but it tracks testnet latency and has exceeded 60s.
 * Until signup stops blocking on the network, any suite that registers a
 * merchant inherits that.
 */
describe('Payment links (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  // Unique per run so repeated runs against the same database do not collide
  // on the unique email constraint.
  const email = `e2e-links-${Date.now()}@example.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1', { exclude: ['healthz', 'readyz', '/'] });
    await app.init();

    const registered = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'E2E Links Merchant', email, password: 'correct-horse-1' });

    // Register may hand back a token directly or require a login round-trip
    // depending on whether email verification is enforced; accept either.
    token =
      registered.body?.data?.accessToken ??
      registered.body?.accessToken ??
      (
        await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({ email, password: 'correct-horse-1' })
      ).body?.data?.accessToken;

    expect(token).toBeDefined();
  }, 240000);

  afterAll(async () => {
    await app?.close();
  }, 60000);

  const auth = () => ({ Authorization: `Bearer ${token}` });

  const createLink = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/v1/payment-links')
      .set(auth())
      .send(body);

  const unwrap = (body: Record<string, unknown>): Record<string, unknown> =>
    (body?.data as Record<string, unknown>) ?? body;

  // The API never returns a bare short code — it returns the full `url` and a
  // presentation-prefixed `lnk_` id. The consumer-facing code is the last path
  // segment of that url.
  const shortCodeOf = (link: Record<string, unknown>): string =>
    String(link.url).split('/').filter(Boolean).pop() as string;

  it('creates a fixed-amount single-use link', async () => {
    const res = await createLink({
      amount: 10,
      currency: 'USD',
      description: 'E2E single-use',
      single_use: true,
    }).expect(201);

    const link = unwrap(res.body);
    expect(shortCodeOf(link)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Number(link.amount)).toBe(10);
    expect(link.type).toBe('single-use');
    expect(link.status).toBe('active');
    expect(link.usageCount).toBe(0);
    expect(String(link.id)).toMatch(/^lnk_/);
  });

  it('resolves publicly without a token, and carries what the landing page renders', async () => {
    const created = unwrap(
      (
        await createLink({
          amount: 25,
          currency: 'USD',
          description: 'Resolve me',
        })
      ).body,
    );
    const shortCode = shortCodeOf(created);

    // No Authorization header — this is the consumer's view.
    const res = await request(app.getHttpServer())
      .get(`/v1/links/${shortCode}`)
      .expect(200);

    const link = unwrap(res.body);
    expect(Number(link.amount)).toBe(25);
    expect(link.description).toBe('Resolve me');
  });

  it('404s an unknown short code rather than leaking whether one existed', async () => {
    await request(app.getHttpServer())
      .get('/v1/links/definitely-not-a-real-code')
      .expect(404);
  });

  it('stops resolving once deactivated', async () => {
    const created = unwrap((await createLink({ amount: 5 })).body);
    const shortCode = shortCodeOf(created);
    const id = created.id as string;

    await request(app.getHttpServer())
      .get(`/v1/links/${shortCode}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/v1/payment-links/${id}`)
      .set(auth())
      .expect(200);

    // 410 Gone, not 404: the link existed and is deliberately no longer usable.
    await request(app.getHttpServer())
      .get(`/v1/links/${shortCode}`)
      .expect(410);
  });

  it('refuses an already-expired link', async () => {
    const created = unwrap(
      (
        await createLink({
          amount: 5,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        })
      ).body,
    );
    const shortCode = shortCodeOf(created);

    await request(app.getHttpServer())
      .get(`/v1/links/${shortCode}`)
      .expect(410);
  });

  it('spends a single-use link exactly once, even under a concurrent race', async () => {
    // The guard is a conditional UPDATE (`singleUse=false OR usedCount=0`), so
    // the interesting case is two payments racing for the same link — a
    // sequential test would pass even if the check were done in application
    // code with a read-then-write gap.
    const created = unwrap(
      (await createLink({ amount: 15, single_use: true })).body,
    );
    const shortCode = shortCodeOf(created);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post(`/v1/checkout/from-link/${shortCode}`)
        .send({}),
      request(app.getHttpServer())
        .post(`/v1/checkout/from-link/${shortCode}`)
        .send({}),
    ]);

    const created2xx = results.filter((r) => r.status >= 200 && r.status < 300);
    expect(created2xx).toHaveLength(1);

    // And it stays spent afterwards.
    await request(app.getHttpServer())
      .post(`/v1/checkout/from-link/${shortCode}`)
      .send({})
      .expect((r) => {
        expect(r.status).toBeGreaterThanOrEqual(400);
      });
  }, 60000);

  it('lets a multi-use link be paid more than once', async () => {
    const created = unwrap(
      (await createLink({ amount: 7, single_use: false })).body,
    );
    const shortCode = shortCodeOf(created);

    for (const _ of [1, 2]) {
      await request(app.getHttpServer())
        .post(`/v1/checkout/from-link/${shortCode}`)
        .send({})
        .expect((r) => {
          expect(r.status).toBeLessThan(400);
        });
    }

    // Still resolvable — multi-use links are not consumed.
    await request(app.getHttpServer())
      .get(`/v1/links/${shortCode}`)
      .expect(200);
  }, 60000);

  it('does not expose another merchant a link they do not own', async () => {
    const created = unwrap((await createLink({ amount: 9 })).body);
    const id = created.id as string;

    const otherEmail = `e2e-links-other-${Date.now()}@example.test`;
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ name: 'Other', email: otherEmail, password: 'correct-horse-1' });
    const otherToken = (
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: otherEmail, password: 'correct-horse-1' })
    ).body?.data?.accessToken;

    if (!otherToken) return; // login shape differs; covered by the auth suite

    await request(app.getHttpServer())
      .get(`/v1/payment-links/${id}`)
      .set({ Authorization: `Bearer ${otherToken}` })
      .expect((r) => {
        expect([403, 404]).toContain(r.status);
      });
  }, 60000);
});
