/**
 * Vashundhara Foundation API - Main Entry Point
 * Multi-tenant, Multi-lingual, Multi-currency Platform
 */

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { TenantMiddleware } from './common/middleware/tenant.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose']
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  const apiPrefix = configService.get<string>('API_PREFIX') || 'api';
  const apiVersion = configService.get<string>('API_VERSION') || '1';
  const corsOrigin = configService.get<string>('CORS_ORIGIN') || '*';

  // Global prefix
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['health', 'metrics']
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion
  });

  // Security
  app.use(helmet({
    contentSecurityPolicy: false, // Configure as needed
    crossOriginEmbedderPolicy: false
  }));

  // CORS
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'Accept-Language'],
    credentials: true
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      },
      validationError: {
        target: false,
        value: false
      }
    })
  );

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Transform Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Tenant Middleware
  app.use(TenantMiddleware);

  // Swagger Documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Vashundhara Foundation API')
      .setDescription('Multi-tenant, Multi-lingual, Multi-currency NGO Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'X-Tenant-ID')
      .addTag('Authentication', 'Auth endpoints')
      .addTag('Tenants', 'Tenant management')
      .addTag('Users', 'User management')
      .addTag('Donations', 'Donation management')
      .addTag('Campaigns', 'Campaign management')
      .addTag('Settings', 'Configuration')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true
      }
    });
  }

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    });
  });

  await app.listen(port);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  Vashundhara Foundation API                                  ║
║  World's First NGO Platform - White Level                    ║
║  vashundharafoundation.org                                   ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${port}                    ║
║  API: http://localhost:${port}/${apiPrefix}/v${apiVersion}        ║
║  Docs: http://localhost:${port}/${apiPrefix}/docs              ║
║  Health: http://localhost:${port}/health                       ║
╚══════════════════════════════════════════════════════════════╝
  `);
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();