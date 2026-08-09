import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Merchant } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Resolves the signing secret, refusing to fall back.
 *
 * This used to read `process.env.JWT_SECRET || 'fallback-dev-secret'`. Two
 * problems, and the second is the serious one:
 *
 *  - the env read happened while the module was being imported, so it depended
 *    on `dotenv/config` having run first, which is only true via `main.ts`; and
 *  - when that read came back empty the app did not stop. It verified access
 *    tokens against a literal string committed to this repository. Anyone who
 *    could read the source could mint a token for any merchant id, and nothing
 *    in the logs would look unusual.
 *
 * A missing secret is a deployment error. Failing at boot turns it into a
 * failed deploy instead of a silent authentication bypass.
 */
function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not configured. Refusing to start: without it, access ' +
        'tokens cannot be verified against anything trustworthy.',
    );
  }
  return secret;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload): Promise<Merchant> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: payload.sub },
    });

    if (!merchant) {
      throw new UnauthorizedException('Merchant not found');
    }

    return merchant;
  }
}
