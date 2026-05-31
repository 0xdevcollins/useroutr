import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
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

  // ── Global pipes / filters / interceptors ───────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // ── URL versioning ──────────────────────────────────────────────────────────
  // Every controller is mounted under /v1/* so integrators can pin a version
  // and we can cut a clean /v2 later. Health endpoints are deliberately
  // excluded — external monitors (Better Stack, k8s probes, ELB) shouldn't
  // have to track API version cuts.
  app.setGlobalPrefix('v1', {
    exclude: ['healthz', 'readyz', '/'],
  });

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `Application is running on: http://localhost:${process.env.PORT}`,
  );
}
void bootstrap();
