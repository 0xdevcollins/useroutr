import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SettlementProvisionProcessor } from './settlement-provision.processor';
import { SETTLEMENT_PROVISION_QUEUE } from './settlement-provision.constants';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { MerchantSettlementService } from './merchant-settlement.service';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    NotificationsModule,
    BullModule.registerQueue({ name: SETTLEMENT_PROVISION_QUEUE }),
  ],
  controllers: [MerchantController],
  providers: [
    MerchantService,
    MerchantSettlementService,
    RolesGuard,
    // Consumes the queue AuthService writes to at registration.
    SettlementProvisionProcessor,
  ],
  // MerchantSettlementService is exported for the dashboard's manual retry.
  // Registration no longer calls it directly — it enqueues instead, so a slow
  // Stellar network cannot hold up someone's signup.
  exports: [MerchantService, MerchantSettlementService],
})
export class MerchantModule {}
