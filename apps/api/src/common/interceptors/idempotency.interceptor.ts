import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import type { Request } from 'express';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24; // 24 hours

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();

    if (req.method !== 'POST') {
      return next.handle();
    }

    const idempotencyKey = req.headers['idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      return next.handle();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;
    const cachedResponse = await this.redis.get(cacheKey);

    if (cachedResponse) {
      return of(JSON.parse(cachedResponse) as unknown);
    }

    return next.handle().pipe(
      tap({
        next: (response: unknown) => {
          void this.redis.setex(
            cacheKey,
            IDEMPOTENCY_TTL_SECONDS,
            JSON.stringify(response),
          );
        },
      }),
    );
  }
}
