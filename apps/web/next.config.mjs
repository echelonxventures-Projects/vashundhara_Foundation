import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export default createNextIntlPlugin('./src/i18n/request.ts')({
  output: 'standalone',
  outputFileTracingRoot: root,
  poweredByHeader: false,
  transpilePackages: ['@vashundhara-foundation/ui'],
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://checkout.razorpay.com")' }, { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }
    ] }];
  }
});
