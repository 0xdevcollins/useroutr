import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { IS_PUBLIC_ROUTE } from '../decorators/public-route.decorator.js';
import type { AuthenticatedRequest } from '../decorators/current-merchant.decorator.js';

@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader: string = request.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    // If the token looks like an API key, use ApiKeyGuard
    if (token.startsWith('ur_live_') || token.startsWith('ur_test_')) {
      return this.apiKeyGuard.canActivate(context);
    }

    // Otherwise try JWT
    try {
      const result = await this.jwtGuard.canActivate(context);
      return Boolean(result);
    } catch {
      throw new UnauthorizedException('Invalid authentication credentials');
    }
  }
}
