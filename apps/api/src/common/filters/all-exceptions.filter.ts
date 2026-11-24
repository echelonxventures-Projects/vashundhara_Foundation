/**
 * Global Exception Filter for Vashundhara Foundation API
 */

import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { Request, Response } from 'express';
import { ZodError } from 'zod';

interface HttpExceptionResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  [key: string]: unknown;
}

interface PrismaErrorMeta {
  target?: string[];
  field_name?: string;
  [key: string]: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, error, details } = this.getErrorDetails(exception);

    // Log error
    this.logger.error(
      `${request.method} ${request.url} - ${statusCode} - ${message}`,
      exception instanceof Error ? exception.stack : ''
    );

    // Send response
    response.status(statusCode).json({
      success: false,
      error: {
        code: error,
        message,
        details,
        statusCode
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: (request.headers['x-request-id'] as string) || this.generateRequestId(),
        path: request.url,
        method: request.method
      }
    });
  }

  private getErrorDetails(exception: unknown): {
    statusCode: number;
    message: string;
    error: string;
    details?: Record<string, unknown>;
  } {
    // HttpException (NestJS built-in)
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      const response = exceptionResponse as HttpExceptionResponse;
      let message: string;
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof response.message === 'string') {
        message = response.message;
      } else if (Array.isArray(response.message)) {
        message = response.message.join(', ');
      } else {
        message = exception.message;
      }

      let details: Record<string, unknown> | undefined;
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        details = exceptionResponse as Record<string, unknown>;
      }

      return {
        statusCode: exception.getStatus(),
        message,
        error: exception.name,
        details
      };
    }

    // Prisma Errors
    if (exception instanceof PrismaClientKnownRequestError) {
      return this.handlePrismaError(exception);
    }

    if (exception instanceof PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data provided',
        error: 'VALIDATION_ERROR',
        details: { prisma: exception.message }
      };
    }

    // Zod Validation Errors
    if (exception instanceof ZodError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        details: { errors: exception.errors }
      };
    }

    // Generic Error
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception.message,
        error: 'INTERNAL_ERROR'
      };
    }

    // Unknown
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Unknown error occurred',
      error: 'UNKNOWN_ERROR'
    };
  }

  private handlePrismaError(error: PrismaClientKnownRequestError): {
    statusCode: number;
    message: string;
    error: string;
    details?: Record<string, unknown>;
  } {
    switch (error.code) {
      case 'P2002': { // Unique constraint violation
        const meta = error.meta as PrismaErrorMeta | undefined;
        const target = meta?.target?.join(', ') || 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `A record with this ${target} already exists`,
          error: 'RESOURCE_CONFLICT',
          details: { field: target, code: error.code }
        };
      }

      case 'P2025': // Record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'RESOURCE_NOT_FOUND',
          details: { code: error.code }
        };

      case 'P2003': { // Foreign key constraint
        const meta = error.meta as PrismaErrorMeta | undefined;
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist',
          error: 'FOREIGN_KEY_VIOLATION',
          details: { field: meta?.field_name, code: error.code }
        };
      }

      case 'P2014': // Relation violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid relation',
          error: 'RELATION_VIOLATION',
          details: { code: error.code }
        };

      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'DATABASE_ERROR',
          details: { code: error.code, meta: error.meta }
        };
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}