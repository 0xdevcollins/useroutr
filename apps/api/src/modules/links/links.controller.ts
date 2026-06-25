import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LinksService } from './links.service.js';
import { CreateLinkSchema } from './dto/create-link.dto.js';
import type { CreateLinkDto } from './dto/create-link.dto.js';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentMerchant } from '../../common/decorators/current-merchant.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

/**
 * Merchant-facing payment-link endpoints. The global `/v1` prefix is applied
 * in main.ts — controller routes here are relative to that.
 *
 * The customer-facing public URL (`pay.useroutr.com/{shortCode}`) is served
 * by the checkout app, which fetches link metadata via the public endpoint
 * added in PR 5. We deliberately don't host an `/api/pay/{shortCode}` redirect
 * here so customer URLs don't carry an API version.
 *
 * `lnk_<cuid>` IDs are accepted on every endpoint that takes `:id` — the
 * prefix is stripped before the DB lookup so dashboards can show prefixed
 * IDs to users without the API having to know about presentation.
 */
@Controller('payment-links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @UseGuards(CombinedAuthGuard)
  @Post()
  async create(
    @CurrentMerchant('id') merchantId: string,
    // Parameter-level pipe — `@UsePipes` at method level applies to every
    // handler argument and incorrectly tries to validate the
    // `@CurrentMerchant` string against the body schema, throwing "expected
    // object, received string." Scoping the pipe to `@Body` fixes that.
    @Body(new ZodValidationPipe(CreateLinkSchema)) dto: CreateLinkDto,
  ) {
    return this.linksService.create(merchantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async list(
    @CurrentMerchant('id') merchantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    // Dashboard sends `status=all` for "no filter" — normalize that to
    // undefined before passing through. Anything outside the known union
    // also collapses to undefined rather than erroring, so a stale or
    // hand-typed value gracefully degrades to "show everything."
    const ALLOWED = ['active', 'expired', 'deactivated'] as const;
    type Allowed = (typeof ALLOWED)[number];
    const normalizedStatus = ALLOWED.includes(status as Allowed)
      ? (status as Allowed)
      : undefined;

    return this.linksService.getByMerchant(merchantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: normalizedStatus,
    });
  }

  @UseGuards(CombinedAuthGuard)
  @Get(':id')
  async getOne(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.linksService.getById(merchantId, stripPrefix(id));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.linksService.deactivate(merchantId, stripPrefix(id));
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/stats')
  async stats(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.linksService.getStats(merchantId, stripPrefix(id));
  }
}

function stripPrefix(id: string): string {
  return id.startsWith('lnk_') ? id.slice(4) : id;
}
