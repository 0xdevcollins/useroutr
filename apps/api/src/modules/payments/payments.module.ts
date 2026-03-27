import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventsModule],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
