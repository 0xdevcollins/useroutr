import { Controller, Get, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LinksService } from './links.service.js';

/**
 * Public payment-link resolver. Called by the hosted checkout app
 * (`apps/checkout`) when a customer lands on `pay.useroutr.com/{shortCode}`.
 *
 * Deliberately separated from `LinksController`:
 *   - LinksController owns merchant-authenticated CRUD (`/v1/payment-links`)
 *   - PublicLinksController owns the unauthenticated read flow
 *     (`/v1/links/{shortCode}`)
 *
 * Different URL prefix on purpose — `payment-links` is the merchant
 * resource collection (plural noun, REST-ish), while `links` is the
 * customer entry point keyed by short code. Two namespaces avoid
 * accidental auth-bypass: every route under `/payment-links` requires a
 * guard, every route under `/links` is public by construction.
 *
 * No global auth guard exists in this app (auth is per-controller via
 * `@UseGuards`), so this controller is unguarded by simply not declaring
 * one. The ThrottlerGuard is global and applies; we tighten the bucket
 * with `@Throttle` because public endpoints draw bots.
 */
@Controller('links')
export class PublicLinksController {
  constructor(private readonly linksService: LinksService) {}

  /**
   * Resolve a payment link by its short code.
   *
   * Returns customer-safe metadata (amount, currency, description,
   * merchant branding) plus enough state for checkout to render an
   * appropriate "this link is no longer accepting payments" screen
   * when applicable.
   *
   * Side effect: increments `viewCount` on the link. Bots and refreshes
   * will inflate this — that's accepted until we wire a proper analytics
   * module that can dedupe.
   *
   * Responses:
   *   - 200 → link is active and ready to render
   *   - 404 → no link with this short code (or short code malformed)
   *   - 410 Gone → link is inactive, expired, or single-use exhausted
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':shortCode')
  @HttpCode(HttpStatus.OK)
  async resolve(@Param('shortCode') shortCode: string) {
    return this.linksService.resolve(shortCode);
  }
}
