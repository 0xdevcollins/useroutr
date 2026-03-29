import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from '../payments/payments.service.js';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RawBodyRequest,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException(
        'Stripe webhook signature verification requires the raw request body.',
      );
    }

    await this.paymentsService.handleStripeWebhook(signature, request.rawBody);

    return { received: true };
  }
}
