import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedResponse<T> {
  data: T;
  meta: PaginationMeta;
}

export interface WrappedResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

function isPaginated(value: unknown): value is PaginatedResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'meta' in value
  );
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  WrappedResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<WrappedResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
        if (isPaginated(data)) {
          return data as unknown as WrappedResponse<T>;
        }
        return { data };
      }),
    );
  }
}
