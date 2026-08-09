import { INestApplication, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Everything that shapes how a request is validated, routed and rendered.
 *
 * This lives apart from `bootstrap()` so the e2e suite configures its app the
 * same way production does. When it did not, the two drifted: the e2e app
 * hand-copied the `/v1` prefix and installed no pipes at all, so a test could
 * pass against an app that validated nothing while the real one validated, or
 * the reverse. A test that exercises a different app than the one shipped is
 * only testing itself.
 *
 * Deliberately excluded: helmet, body limits and CORS. Those read `process.env`
 * and describe how the app is *exposed* to the network, which is a property of
 * the deployment rather than of the API, and no e2e test asserts on them.
 */
export function configureApp(app: INestApplication): INestApplication {
  // Without this pipe every `class-validator` decorator in the codebase is
  // decorative: `@IsIn`, `@Min` and friends only run if something invokes them,
  // and nothing did. `PATCH /merchants/me/settlement` accepted
  // `settlementAsset: "NOTANASSET"` with a 200 and wrote it to the database,
  // where it goes on to pick a withdrawal rail. Only the Zod DTOs were ever
  // enforced, because those routes bind an explicit ZodValidationPipe.
  //
  // The Zod DTOs are `z.infer` *types*, so their runtime metatype is `Object`
  // and this pipe skips them — it applies to the class DTOs it was written for
  // and leaves the Zod routes to their own pipe.
  //
  // `whitelist` strips properties no DTO declares, so a client cannot smuggle a
  // field past a service that spreads the body. It is not paired with
  // `forbidNonWhitelisted`: rejecting the whole request over one stray property
  // would break existing callers that send extra fields today.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // Every controller is mounted under /v1/* so integrators can pin a version
  // and we can cut a clean /v2 later. Health endpoints are deliberately
  // excluded — external monitors (Better Stack, k8s probes, ELB) shouldn't
  // have to track API version cuts.
  app.setGlobalPrefix('v1', {
    exclude: ['healthz', 'readyz', '/'],
  });

  return app;
}
