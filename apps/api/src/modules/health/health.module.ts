import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

/**
 * Health module — owns /healthz and /readyz. Imports ConfigModule
 * explicitly because HealthService reads STELLAR_HORIZON_URL. Prisma and
 * Redis are already global (via PrismaModule and RedisModule.forRoot) so
 * no extra imports are needed for those.
 */
@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
