import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER_NAME = 'X-Request-Id';
const MAX_LENGTH = 128;

/**
 * Stamps every incoming request with an `id` for log correlation and
 * client-side debugging.
 *
 * Behaviour:
 *  - Echoes the inbound `X-Request-Id` if the client supplies one and it
 *    looks reasonable (non-empty, ≤ 128 chars). Lets reverse proxies and
 *    front-end SDKs hand a trace id through.
 *  - Otherwise generates a v4 UUID.
 *  - Always sets `X-Request-Id` on the response so the caller can echo it
 *    back when reporting an issue.
 *  - Attaches the id to `req.id` so controllers, interceptors, filters,
 *    and the logger can reference it.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(HEADER_NAME);
    const id = isAcceptable(incoming) ? incoming : randomUUID();

    req.id = id;
    res.setHeader(HEADER_NAME, id);

    next();
  }
}

function isAcceptable(value: string | undefined): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LENGTH;
}

/**
 * Augments Express's Request type so `req.id` is strongly typed everywhere
 * downstream — controllers, interceptors, the global exception filter, etc.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
    }
  }
}
