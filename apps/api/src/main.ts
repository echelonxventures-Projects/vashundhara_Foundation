import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { ENV, Env } from './env';
import { configure } from './setup';

async function main() {
  if (process.env.SENTRY_DSN) Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV, sendDefaultPii: false });
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: false, logger: ['error', 'warn', 'log'] });
  configure(app);
  await app.listen(app.get<Env>(ENV).PORT, '0.0.0.0');
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
