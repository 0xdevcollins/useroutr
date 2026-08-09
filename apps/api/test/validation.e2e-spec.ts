import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

/**
 * Guards the global `ValidationPipe`.
 *
 * It is worth its own suite because its absence was invisible: every
 * `class-validator` decorator still compiled, still read correctly, and still
 * did nothing. `PATCH /merchants/me/settlement` answered 200 to an asset that
 * does not exist and persisted it. Nothing failed, so nothing pointed at it.
 *
 * These cases fail loudly if the pipe is ever dropped from `configureApp`.
 *
 * Needs Postgres and Redis up, and migrations applied:
 *
 *   docker compose up -d postgres redis
 *   npx prisma migrate deploy && npx prisma generate
 */
describe('Request validation (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const email = `e2e-validation-${Date.now()}@example.test`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const registered = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        name: 'E2E Validation Merchant',
        email,
        password: 'correct-horse-1',
      });

    token =
      registered.body?.data?.accessToken ?? registered.body?.accessToken ?? '';

    if (!token) {
      const login = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email, password: 'correct-horse-1' });
      token = login.body?.data?.accessToken ?? login.body?.accessToken ?? '';
    }
  }, 60000);

  afterAll(async () => {
    await app?.close();
  }, 60000);

  const patch = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch('/v1/merchants/me/settlement')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('rejects a settlement asset that is not supported', async () => {
    await patch({ settlementAsset: 'NOTANASSET' }).expect(400);
  });

  it('rejects a settlement chain that is not supported', async () => {
    await patch({ settlementChain: 'dogecoin' }).expect(400);
  });

  it('rejects a hold window below the one-hour floor', async () => {
    await patch({ settlementHoldSeconds: 60 }).expect(400);
  });

  it('rejects a hold window above the thirty-day ceiling', async () => {
    await patch({ settlementHoldSeconds: 60 * 60 * 24 * 31 }).expect(400);
  });

  it('rejects a non-boolean hold flag', async () => {
    await patch({ settlementHoldEnabled: 'yes' }).expect(400);
  });

  it('accepts a valid settlement update and persists it', async () => {
    await patch({
      settlementAsset: 'USDC',
      settlementChain: 'stellar',
      settlementHoldEnabled: true,
      settlementHoldSeconds: 172800,
    }).expect(200);

    const me = await request(app.getHttpServer())
      .get('/v1/merchants/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const merchant = me.body?.data ?? me.body;
    expect(merchant.settlementAsset).toBe('USDC');
    expect(merchant.settlementHoldEnabled).toBe(true);
    expect(merchant.settlementHoldSeconds).toBe(172800);
  });

  // `whitelist` also strips undeclared properties, but this endpoint's service
  // builds its Prisma `data` field by field, so a stray property has no
  // observable effect here and any assertion would pass vacuously. Left
  // untested rather than tested for the wrong reason.
});
