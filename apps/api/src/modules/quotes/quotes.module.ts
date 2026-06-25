import { Module } from '@nestjs/common';
import { StellarModule } from '../stellar/stellar.module';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CctpModule } from '../cctp/cctp.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StellarModule, PrismaModule, CctpModule, AuthModule],
  providers: [QuotesService],
  controllers: [QuotesController],
  exports: [QuotesService],
})
export class QuotesModule {}
