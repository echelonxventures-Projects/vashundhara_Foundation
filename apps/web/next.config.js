/** @type {import('next').NextConfig} */
const path = require('path')
const withNextIntl = require('next-intl/plugin')('./i18n.ts')

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@vashundhara-foundation/ui',
    '@vashundhara-foundation/shared',
    '@vashundhara-foundation/i18n',
    '@vashundhara-foundation/auth',
    '@vashundhara-foundation/feature-flags'
  ],
  experimental: {
    optimizePackageImports: ['@vashundhara-foundation/ui', 'lucide-react']
  },
  images: {
    domains: ['localhost', 'vashundharafoundation.org', '*.vashundharafoundation.org'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.vashundharafoundation.org'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      }
    ]
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
      '@vashundhara-foundation/api': path.resolve(__dirname, '../api/src'),
      '@vashundhara-foundation/web': path.resolve(__dirname, 'src'),
      '@vashundhara-foundation/admin': path.resolve(__dirname, '../admin/src'),
      '@vashundhara-foundation/config': path.resolve(__dirname, '../../packages/config/src'),
      '@vashundhara-foundation/database': path.resolve(__dirname, '../../packages/database/src'),
      '@vashundhara-foundation/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@vashundhara-foundation/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@vashundhara-foundation/i18n': path.resolve(__dirname, '../../packages/i18n/src'),
      '@vashundhara-foundation/auth': path.resolve(__dirname, '../../packages/auth/src'),
      '@vashundhara-foundation/feature-flags': path.resolve(__dirname, '../../packages/feature-flags/src'),
    }
    return config
  },
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/trpc/:path*`
      },
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/:path*`
      }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' }
        ]
      }
    ]
  }
}

module.exports = withNextIntl(nextConfig)