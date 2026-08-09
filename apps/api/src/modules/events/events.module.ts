import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events/events.gateway';
import { EventsService } from './events/events.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // The websocket gateway authenticates with the same tokens the REST API
    // issues, so it needs the same secret — and must not accept a fallback one.
    // See the note in `auth/strategies/jwt.strategy.ts`: verifying against a
    // literal committed to this repo is an authentication bypass, and it is
    // worse here, because a socket that connects stays connected.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET is not configured. Refusing to start the events gateway.',
          );
        }
        return { secret };
      },
    }),
  ],
  providers: [EventsGateway, EventsService],
  exports: [EventsGateway, EventsService],
})
export class EventsModule {}
