/**
 * Transform Interceptor for Vashundhara Foundation API
 * Standardizes API response format
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    statusCode: number;
  };
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
    path?: string;
    method?: string;
  };
}

interface FormattedResponse {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    statusCode: number;
  };
  meta?: {
    timestamp?: string;
    requestId?: string;
    version?: string;
    path?: string;
    method?: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || this.generateRequestId();

    return next.handle().pipe(
      map((data: unknown): ApiResponse<T> => {
        // If data is already formatted (has success property), return as-is
        if (data && typeof data === 'object' && 'success' in data) {
          const formattedData = data as FormattedResponse;
          return {
            ...formattedData,
            meta: {
              ...formattedData.meta,
              timestamp: new Date().toISOString(),
              requestId,
              version: '1.0.0',
              path: request.url,
              method: request.method
            }
          } as ApiResponse<T>;
        }

        // Otherwise wrap in standard format
        return {
          success: true,
          data: data as T,
          meta: {
            timestamp: new Date().toISOString(),
            requestId,
            version: '1.0.0',
            path: request.url,
            method: request.method
          }
        };
      })
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}