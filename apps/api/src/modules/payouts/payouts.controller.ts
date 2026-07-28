import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import {
  CreatePayoutSchema,
  CreatePayoutDto,
  BulkPayoutSchema,
  BulkPayoutDto,
  CreateRecurringPayoutSchema,
  CreateRecurringPayoutDto,
  UpdateRecurringPayoutSchema,
  UpdateRecurringPayoutDto,
} from './dto/create-payout.dto';
import {
  PayoutFiltersSchema,
  PayoutFiltersDto,
} from './dto/payout-filters.dto';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentMerchant } from '../merchant/decorators/current-merchant.decorator';

// Global `/v1` prefix is set in main.ts — controller routes are relative.
@Controller('payouts')
@UseGuards(CombinedAuthGuard)
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  // ── POST /v1/payouts ──────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentMerchant('id') merchantId: string,
    @Body(new ZodValidationPipe(CreatePayoutSchema)) dto: CreatePayoutDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payoutsService.create(merchantId, dto, idempotencyKey);
  }

  // ── POST /v1/payouts/bulk ─────────────────────────────────────────────────
  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  async createBulk(
    @CurrentMerchant('id') merchantId: string,
    @Body(new ZodValidationPipe(BulkPayoutSchema)) dto: BulkPayoutDto,
  ) {
    return this.payoutsService.createBulk(merchantId, dto);
  }

  // ── GET /v1/payouts ───────────────────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentMerchant('id') merchantId: string,
    @Query(new ZodValidationPipe(PayoutFiltersSchema))
    filters: PayoutFiltersDto,
  ) {
    return this.payoutsService.list(merchantId, filters);
  }

  @Post('recurring')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRecurring(
    @CurrentMerchant('id') merchantId: string,
    @Body(new ZodValidationPipe(CreateRecurringPayoutSchema))
    dto: CreateRecurringPayoutDto,
  ) {
    return this.payoutsService.createRecurring(merchantId, dto);
  }

  @Get('recurring')
  @UseGuards(JwtAuthGuard)
  async listRecurring(@CurrentMerchant('id') merchantId: string) {
    return this.payoutsService.listRecurring(merchantId);
  }

  @Get('recurring/:id')
  @UseGuards(JwtAuthGuard)
  async getRecurring(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.payoutsService.getRecurring(id, merchantId);
  }

  @Patch('recurring/:id')
  @UseGuards(JwtAuthGuard)
  async updateRecurring(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateRecurringPayoutSchema))
    dto: UpdateRecurringPayoutDto,
  ) {
    return this.payoutsService.updateRecurring(id, merchantId, dto);
  }

  @Delete('recurring/:id')
  @UseGuards(JwtAuthGuard)
  async deleteRecurring(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.payoutsService.deleteRecurring(id, merchantId);
  }

  // ── GET /v1/payouts/:id ───────────────────────────────────────────────────
  @Get(':id')
  async getOne(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.payoutsService.getById(id, merchantId);
  }

  // ── POST /v1/payouts/:id/cancel ───────────────────────────────────────────
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancel(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.payoutsService.cancel(id, merchantId);
  }

  // ── POST /v1/payouts/:id/retry ────────────────────────────────────────────
  @Post(':id/retry')
  @UseGuards(JwtAuthGuard)
  async retry(
    @CurrentMerchant('id') merchantId: string,
    @Param('id') id: string,
  ) {
    return this.payoutsService.retry(id, merchantId);
  }
}
