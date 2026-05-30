import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [MerchantController],
  providers: [MerchantService, RolesGuard],
  exports: [MerchantService],
})
export class MerchantModule {}
