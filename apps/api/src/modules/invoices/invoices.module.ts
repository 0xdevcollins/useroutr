import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PdfService } from './pdf.service';
import {
  InvoicesReminderProcessor,
  INVOICE_REMINDER_QUEUE,
} from './invoices.reminder.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    NotificationsModule,
    WebhooksModule,
    AuthModule,
    BullModule.registerQueue({ name: INVOICE_REMINDER_QUEUE }),
  ],
  providers: [InvoicesService, PdfService, InvoicesReminderProcessor],
  controllers: [InvoicesController],
  exports: [InvoicesService],
})
export class InvoicesModule {}
