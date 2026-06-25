import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PublicRoute } from '../../common/decorators/public-route.decorator.js';
import { HealthService } from './health.service.js';

/**
 * Health endpoints, mounted OUTSIDE the /v1 prefix so they survive any
 * future version cuts and so external monitors don't have to track API
 * versioning. Both endpoints are unauthenticated and excluded from the
 * default rate limiter — Better Stack pings these constantly.
 *
 *  GET /healthz  → liveness  → 200 if the process is up
 *  GET /readyz   → readiness → 200 only when every dependency is reachable
 */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness probe — answers "is the process responding at all?".
   * Returns 200 unconditionally. If the event loop is stuck the request
   * never completes; the load balancer will draw its own conclusions.
   */
  @PublicRoute()
  @SkipThrottle()
  @Get('healthz')
  @HttpCode(HttpStatus.OK)
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness probe — answers "can the process actually do its job?".
   * Polls Postgres, Redis, and Stellar Horizon. Returns 200 with a per-
   * dependency report when everything is reachable, 503 otherwise.
   *
   * `Res` is injected so we can set the status code based on the report
   * without the controller signature implying everything always succeeds.
   */
  @PublicRoute()
  @SkipThrottle()
  @Get('readyz')
  async readiness(@Res() res: Response): Promise<void> {
    const report = await this.health.checkReadiness();
    res
      .status(report.ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(report);
  }
}
