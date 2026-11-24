import { INestApplication, VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ENV, Env } from './env';
import { httpDuration } from './modules/system/health';

// Money is stored as BigInt minor units and always fits a safe integer in JSON.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) {
  return Number(this);
};

export function configure(app: INestApplication) {
  const env = app.get<Env>(ENV);
  const http = app as NestExpressApplication;
  http.set('trust proxy', env.TRUST_PROXY_HOPS);
  http.set('query parser', 'simple');
  http.disable('x-powered-by');
  http.useBodyParser('json', { limit: '3mb' });
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const end = httpDuration.startTimer();
    const started = Date.now();
    res.setHeader('cache-control', 'no-store');
    res.on('finish', () => {
      const route = (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
      end({ method: req.method, route, status: String(res.statusCode) });
      if (env.NODE_ENV === 'production') console.log(JSON.stringify({ level: 'info', method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started, requestId: res.getHeader('x-request-id') }));
    });
    next();
  });
  app.enableCors({ origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()), credentials: true, allowedHeaders: ['content-type', 'authorization', 'x-requested-with', 'x-tenant-slug', 'x-request-id'] });
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready', 'metrics'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  if (env.NODE_ENV !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('NGO Platform API').setVersion('1').addBearerAuth().build());
    SwaggerModule.setup('api/docs', app, doc);
  }
}
