import { z } from 'zod';

const bool = (d: boolean) => z.enum(['true', 'false']).default(d ? 'true' : 'false').transform((v) => v === 'true');

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(40),
  ROOT_DOMAIN: z.string().default('localhost'),
  APP_URL: z.string().url().default('http://localhost:3001'),
  DEFAULT_TENANT_SLUG: z.string().default('vashundhara'),
  CORS_ORIGIN: z.string().default('http://localhost:3001,http://localhost:3002'),
  TRUST_PROXY_HOPS: z.coerce.number().default(0),
  INTERNAL_PROXY_SECRET: z.string().min(16).optional(),
  WORKER_ENABLED: bool(true),
  SIGNUP_NGO_ENABLED: bool(true),
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().default('no-reply@localhost'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_SENDER_ID: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('ap-south-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  CLAMAV_HOST: z.string().optional(),
  CLAMAV_PORT: z.coerce.number().default(3310),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  METRICS_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type Env = z.infer<typeof Schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const r = Schema.safeParse(cleaned);
  if (!r.success) {
    throw new Error(`Invalid environment: ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
  }
  const e = r.data;
  if (e.NODE_ENV === 'production') {
    const bad: string[] = [];
    if (/change|secret-key|your-/i.test(e.JWT_SECRET)) bad.push('JWT_SECRET is a placeholder');
    if (e.CORS_ORIGIN.includes('*')) bad.push('CORS_ORIGIN must list exact origins');
    if (!e.APP_URL.startsWith('https://')) bad.push('APP_URL must be https');
    if (!e.INTERNAL_PROXY_SECRET) bad.push('INTERNAL_PROXY_SECRET is required');
    if (!e.S3_BUCKET || !e.CLAMAV_HOST) bad.push('S3_BUCKET and CLAMAV_HOST are required');
    if (!e.SMTP_URL) bad.push('SMTP_URL is required');
    if (bad.length) throw new Error(`Unsafe production environment: ${bad.join('; ')}`);
  }
  return e;
}

export const ENV = Symbol('ENV');
