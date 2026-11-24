import { defineConfig } from '@playwright/test';
/** Needs a seeded test database: see docs/OPERATIONS.md. Never point it at real data. */
export default defineConfig({
  testDir: './e2e', timeout: 60_000, workers: 1, retries: process.env.CI ? 1 : 0, reporter: [['list']],
  use: { baseURL: 'http://localhost:3101', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'pnpm --dir ../../packages/database exec tsx prisma/e2e-fixture.ts && node ../api/dist/main.js', url: 'http://localhost:3100/health', reuseExistingServer: false, timeout: 60_000, env: { NODE_ENV: 'test', PORT: '3100', DATABASE_URL: process.env.TEST_DATABASE_URL!, REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379', JWT_SECRET: 'browser-tests-only'.padEnd(48, 'x'), ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), APP_URL: 'http://localhost:3101', DEFAULT_TENANT_SLUG: 'vashundhara', ROOT_DOMAIN: 'localhost' } },
    { command: 'node .next/standalone/apps/web/server.js', url: 'http://localhost:3101/health', reuseExistingServer: false, timeout: 60_000, env: { API_INTERNAL_URL: 'http://localhost:3100', PORT: '3101', HOSTNAME: 'localhost' } }
  ]
});
