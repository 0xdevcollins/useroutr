import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  CheckoutPaymentsController,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { CctpProcessor } from './cctp.processor';
import { CCTP_OBSERVE_QUEUE } from './cctp.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { QuotesModule } from '../quotes/quotes.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { StripeWebhooksController } from '../webhooks/webhooks.controller';
import { AuthModule } from '../auth/auth.module';
import { LinksModule } from '../links/links.module';
import { CctpModule } from '../cctp/cctp.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EventsModule,
    QuotesModule,
    WebhooksModule,
    // PaymentsService.createFromLink resolves a public payment link, atomically
    // marks it used, and creates a pre-quote Payment row in one step. Pulling
    // LinksModule here is one-way — LinksModule does not depend on payments.
    LinksModule,
    // CctpModule for the customer crypto pay flow: selectCrypto + submitBurn
    // call CctpService.prepareBurn to encode the wallet payload, and the
    // CctpProcessor below uses CctpService.observe to drive attestation.
    CctpModule,
    // BullMQ queue + worker for the SOURCE_LOCKED → PROCESSING → COMPLETED
    // transition driven by Iris attestation polling. Lives in this module
    // (not CctpModule) so the processor can inject PaymentsService without
    // a module-level circular dependency.
    BullModule.registerQueue({ name: CCTP_OBSERVE_QUEUE }),
  ],
  providers: [PaymentsService, CctpProcessor],
  controllers: [
    PaymentsController,
    CheckoutPaymentsController,
    StripeWebhooksController,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
