import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
export default {
  output: 'standalone', outputFileTracingRoot: root, poweredByHeader: false, transpilePackages: ['@vashundhara-foundation/ui'],
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }, { key: 'X-Robots-Tag', value: 'noindex' }] }];
  }
};
