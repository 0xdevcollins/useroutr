import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
  Header,
  StreamableFile,
  Req,
  Logger,
  Headers,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentFiltersDto } from './dto/payment-filters.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { BankWebhookDto } from './dto/bank-webhook.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard';

interface AuthenticatedRequest extends Request {
  user?: { id: string; merchantId?: string };
}

// Global `/v1` prefix is set in main.ts — controller routes are relative.
@Controller()
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments')
  @UseGuards(ApiKeyGuard)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<PaymentResponseDto> {
    const merchantId = req.user?.id || req.user?.merchantId;
    if (!merchantId) {
      throw new Error('Unable to resolve merchant identity');
    }
    return this.paymentsService.create(merchantId, dto, idempotencyKey);
  }

  @Get('payments/export')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payments.csv"')
  async export(
    @Req() req: AuthenticatedRequest,
    @Query() filters: PaymentFiltersDto,
  ) {
    const merchantId = req.user?.merchantId || req.user?.id;
    if (!merchantId) {
      throw new Error('Unable to resolve merchant identity');
    }
    const csvBuffer = await this.paymentsService.exportTransactions(
      merchantId,
      filters,
    );
    return new StreamableFile(csvBuffer);
  }

  @Get('payments/:id')
  @UseGuards(CombinedAuthGuard)
  async getDetail(@Param('id') id: string) {
    return this.paymentsService.getById(id);
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() filters: PaymentFiltersDto,
  ) {
    const merchantId = req.user?.merchantId || req.user?.id;
    if (!merchantId) {
      throw new Error('Unable to resolve merchant identity');
    }
    return this.paymentsService.getByMerchant(merchantId, filters);
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  async listAlias(
    @Req() req: AuthenticatedRequest,
    @Query() filters: PaymentFiltersDto,
  ) {
    const merchantId = req.user?.merchantId || req.user?.id;
    if (!merchantId) {
      throw new Error('Unable to resolve merchant identity');
    }
    return this.paymentsService.getByMerchant(merchantId, filters);
  }

  @Post('refunds')
  @UseGuards(CombinedAuthGuard)
  async initiateRefund(@Body() body: { paymentId: string }) {
    return this.paymentsService.initiateRefund(body.paymentId);
  }

  @Post('payments/:id/card-session')
  createCardSession(@Param('id') paymentId: string) {
    return this.paymentsService.createCardSession(paymentId);
  }

  @Post('payments/:id/bank-session')
  async getOrCreateBankSession(@Param('id') id: string) {
    return this.paymentsService.getOrCreateBankSession(id);
  }

  @Post('payments/:id/bank-session/regenerate')
  async regenerateBankSession(@Param('id') id: string) {
    return this.paymentsService.regenerateBankSession(id);
  }

  @Post('payments/:id/bank-sent')
  async markBankSent(@Param('id') id: string) {
    return this.paymentsService.markBankTransferSent(id);
  }

  @Post('payments/bank-webhook')
  async bankWebhook(
    @Body() body: BankWebhookDto,
    @Headers('x-bank-webhook-secret') secret?: string,
  ) {
    this.paymentsService.verifyBankWebhookSecret(secret);
    return this.paymentsService.handleBankTransferNotice(body);
  }
}

@Controller()
export class CheckoutPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('checkout/:paymentId')
  getCheckoutPayment(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getCheckoutPayment(paymentId);
  }

  @Get('checkout/:paymentId/quote')
  getCheckoutQuote(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getCheckoutQuote(paymentId);
  }

  /**
   * Create a payment from a public payment link. Called by the hosted
   * checkout app when a customer clicks "Pay" on `/l/{shortCode}` — there
   * is no merchant credential; the shortCode is the only authorizer.
   *
   * Body is `{ amount?: number }` — required only for open-amount links
   * (where `link.amount` is null). Ignored for fixed-amount links.
   *
   * Response: `{ id }` — the new payment ID. The checkout app navigates
   * the customer to `/{id}` to pick a payment method.
   */
  @Post('checkout/from-link/:shortCode')
  createFromLink(
    @Param('shortCode') shortCode: string,
    @Body() body: { amount?: number },
  ) {
    return this.paymentsService.createFromLink(shortCode, {
      amount: body?.amount,
    });
  }

  // ── Customer crypto pay flow (CCTP V2 EVM → Stellar) ───────────────────
  //
  // Three-step flow, all public, paymentId is the credential. See
  // `apps/api/docs/architecture/crypto-pay-flow.md` for the state
  // machine + rationale.
  //
  //   POST   /checkout/:paymentId/select-crypto    → lock quote + return wallet payload
  //   POST   /checkout/:paymentId/burn-submitted   → record sourceTxHash, transition to SOURCE_LOCKED
  //   GET    /checkout/:paymentId/crypto-status    → poll-able status surface
  //
  // The worker that drives SOURCE_LOCKED → PROCESSING → COMPLETED lands
  // in PR 7.8b. Until then, payments stay in SOURCE_LOCKED after
  // burn-submitted — the status endpoint reflects that.

  @Post('checkout/:paymentId/select-crypto')
  selectCrypto(
    @Param('paymentId') paymentId: string,
    @Body() body: { sourceChain: string },
  ) {
    if (!body?.sourceChain) {
      throw new BadRequestException('sourceChain is required');
    }
    return this.paymentsService.selectCrypto(paymentId, body.sourceChain);
  }

  @Post('checkout/:paymentId/burn-submitted')
  burnSubmitted(
    @Param('paymentId') paymentId: string,
    @Body() body: { sourceTxHash: string },
  ) {
    if (!body?.sourceTxHash || !/^0x[0-9a-fA-F]{64}$/.test(body.sourceTxHash)) {
      throw new BadRequestException(
        'sourceTxHash must be a 0x-prefixed 32-byte hex string',
      );
    }
    return this.paymentsService.submitBurn(paymentId, body.sourceTxHash);
  }

  @Get('checkout/:paymentId/crypto-status')
  cryptoStatus(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getCryptoStatus(paymentId);
  }
}
