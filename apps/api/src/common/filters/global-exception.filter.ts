import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

interface HttpExceptionBody {
  message?: string;
  code?: string;
  details?: unknown;
}

function isExceptionBody(value: unknown): value is HttpExceptionBody {
  return typeof value === 'object' && value !== null;
}

const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'invalid_request',
  [HttpStatus.UNAUTHORIZED]: 'unauthorized',
  [HttpStatus.FORBIDDEN]: 'unauthorized',
  [HttpStatus.NOT_FOUND]: 'not_found',
  [HttpStatus.CONFLICT]: 'quote_expired',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'insufficient_liquidity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let code = 'internal_error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body: unknown = exception.getResponse();

      if (isExceptionBody(body)) {
        message = body.message ?? exception.message;
        code = body.code ?? STATUS_CODE_MAP[status] ?? 'internal_error';
        details = body.details;
      } else {
        code = STATUS_CODE_MAP[status] ?? 'internal_error';
      }
    } else {
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const errorResponse = {
      error: {
        code,
        message,
        docs: `https://docs.useroutr.io/errors/${code}`,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }
}
