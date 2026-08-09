import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { CombinedAuthGuard } from '../../common/guards/combined-auth.guard.js';
<<<<<<< Updated upstream
import { BullModule } from '@nestjs/bullmq';
import { SETTLEMENT_PROVISION_QUEUE } from '../merchant/settlement-provision.constants';
import { NotificationsModule } from '../notifications/notifications.module.js';
// MerchantSettlementService is provided directly here (rather than via
// MerchantModule import) to avoid the circular dependency: MerchantModule
// already imports AuthModule for the guards. The service only depends on
// PrismaService + ConfigService, both globally available, so dropping it
// in this provider list is safe.
import { MerchantSettlementService } from '../merchant/merchant-settlement.service.js';
=======
import { NotificationsModule } from '../notifications/notifications.module.js';
>>>>>>> Stashed changes

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // `register` read `process.env.JWT_SECRET` while this file was being
    // imported, which made token signing depend on import order: it worked from
    // `main.ts` only because `import 'dotenv/config'` happens to run first
    // there. Anything importing `AppModule` directly — the e2e suite, a script,
    // a future worker entrypoint — got `secret: undefined` and every login died
    // with "secretOrPrivateKey must have a value", far from the cause.
    //
    // `registerAsync` defers the read to instantiation, by which point
    // ConfigModule has loaded the environment no matter who booted the app.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        // Failing here names the missing variable at boot. Letting it through
        // defers the failure to the first login attempt, as an opaque 500.
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not configured. Token signing cannot start.',
          );
        }
        return { secret, signOptions: { expiresIn: '15m' } };
      },
    }),
    NotificationsModule,
<<<<<<< Updated upstream
    // Registration enqueues settlement-wallet provisioning rather than waiting
    // on two Stellar round trips inside the request.
    BullModule.registerQueue({ name: SETTLEMENT_PROVISION_QUEUE }),
=======
>>>>>>> Stashed changes
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    ApiKeyGuard,
    CombinedAuthGuard,
    MerchantSettlementService,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, ApiKeyGuard, CombinedAuthGuard],
})
export class AuthModule {}
