import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { StellarModule } from './modules/stellar/stellar.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { LinksModule } from './modules/links/links.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RampModule } from './modules/ramp/ramp.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { CctpModule } from './modules/cctp/cctp.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { RecipientsModule } from './modules/recipients/recipients.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    EventsModule,
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL,
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
      },
      {
        name: 'quote',
        ttl: 60000,
        limit: 30,
      },
    ]),
    StellarModule,
    MerchantModule,
    PaymentsModule,
    QuotesModule,
    PayoutsModule,
    InvoicesModule,
    LinksModule,
    WebhooksModule,
    RampModule,
    NotificationsModule,
    RecipientsModule,
    AnalyticsModule,
    HealthModule,
    CctpModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,

      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Stamp every incoming request with `req.id`. Wired here (rather than in
   * main.ts) so it sits inside the Nest DI graph and any future
   * middleware in this stack can resolve services normally.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
