import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { MerchantSettlementService } from './merchant-settlement.service';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [MerchantController],
  providers: [MerchantService, MerchantSettlementService, RolesGuard],
  // Export MerchantSettlementService so AuthService can call .provision()
  // right after creating the merchant row at register time.
  exports: [MerchantService, MerchantSettlementService],
})
export class MerchantModule {}
