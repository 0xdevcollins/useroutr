import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import {
  EnvValidationError,
  validateEnvironmentConfig,
} from './common/config/env-validation';

async function bootstrap() {
  // Validate critical environment variables before starting the application.
  // dotenv/config is imported at the top of this file, so .env is already
  // loaded into process.env by the time this runs.
  try {
    validateEnvironmentConfig();
  } catch (err) {
    if (err instanceof EnvValidationError) {
      new Logger('EnvValidation').error(err.message);
      process.exit(1);
    }
    throw err;
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    }),
  );

  // ── Request size limits ─────────────────────────────────────────────────────
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // ── CORS ────────────────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === 'production';

  const allowedOrigins: string[] = [
    process.env.WWW_URL,
    process.env.DASHBOARD_URL,
    process.env.CHECKOUT_URL,
  ].filter(Boolean) as string[];

  // Allow localhost origins in non-production environments only
  if (!isProduction) {
    allowedOrigins.push(
      'http://localhost:3000', // www
      'http://localhost:3001', // dashboard
      'http://localhost:3002', // checkout
      'http://localhost:3003', // checkout alt
    );
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── Pipes / filters / interceptors / versioning ─────────────────────────────
  // Shared with the e2e suite so both run the same request pipeline.
  configureApp(app);

  // Without this, SIGTERM kills the process outright: Node's default handler
  // exits before Nest runs a single shutdown hook. The process does stop — but
  // in-flight requests are cut mid-response, queue workers never drain, and
  // Prisma/Redis connections are dropped rather than closed. Enabling the hooks
  // makes a rolling deploy or a container stop drain instead of sever.
  app.enableShutdownHooks();

  // Bound how long a graceful shutdown may take.
  //
  // Nest's hooks close queue workers via `worker.close()`, which is graceful:
  // BullMQ waits for whatever job is mid-flight to finish. A job stuck against
  // a slow third party — an email provider retrying, an RPC not answering —
  // therefore holds the process open indefinitely, past the orchestrator's
  // grace period, until it sends SIGKILL. A hard kill is strictly worse than
  // a deliberate exit: it takes the process down at an arbitrary point with no
  // log line explaining why.
  //
  // So the deadline is ours rather than the platform's. The timer is unref'd,
  // so it only ever fires if something else is still holding the loop open —
  // a clean shutdown exits before it matters.
  //
  // A job interrupted this way is not lost: BullMQ marks an active job with a
  // dead worker as stalled and another worker picks it up, which is why
  // forcing the exit is safe where abandoning writes would not be.
  //
  // The default is measured, not guessed. A healthy shutdown of this app takes
  // ~21s — BullMQ's workers hold blocking Redis connections that take time to
  // drain — so anything under that force-kills a shutdown that was going to
  // succeed. 30s leaves headroom and matches the grace period Kubernetes and
  // most platforms use by default, so the deadline is ours rather than
  // arriving as an unexplained SIGKILL.
  const shutdownGraceMs = Number(process.env.SHUTDOWN_GRACE_MS ?? 30_000);
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      const deadline = setTimeout(() => {
        new Logger('Shutdown').error(
          `Shutdown did not complete within ${shutdownGraceMs}ms — forcing exit. ` +
            'A queue job was most likely still in flight; it will be retried as stalled.',
        );
        process.exit(1);
      }, shutdownGraceMs);
      deadline.unref();
    });
  }

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `Application is running on: http://localhost:${process.env.PORT}`,
  );
}
void bootstrap();
