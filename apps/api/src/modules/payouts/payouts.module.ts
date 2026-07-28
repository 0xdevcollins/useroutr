import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { PayoutsProcessor } from './payouts.processor';
import { PAYOUTS_QUEUE } from './payouts.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { StellarModule } from '../stellar/stellar.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    WebhooksModule,
    StellarModule,
    AuthModule,
    EventsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: PAYOUTS_QUEUE }),
  ],
  providers: [PayoutsService, PayoutsProcessor],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
