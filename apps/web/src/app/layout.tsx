import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/toaster'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
})

export const metadata: Metadata = {
  title: {
    default: 'Vashundhara Foundation - World\'s First NGO Platform',
    template: '%s | Vashundhara Foundation'
  },
  description: 'Enterprise-grade multi-tenant, multi-lingual, multi-currency platform for NGOs worldwide.',
  keywords: ['NGO', 'donations', 'fundraising', 'non-profit', 'charity', 'multi-tenant', 'multi-lingual'],
  authors: [{ name: 'Vashundhara Foundation', url: 'https://vashundharafoundation.org' }],
  creator: 'Vashundhara Foundation',
  publisher: 'Vashundhara Foundation',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://vashundharafoundation.org',
    siteName: 'Vashundhara Foundation',
    title: 'Vashundhara Foundation - World\'s First NGO Platform',
    description: 'Enterprise-grade multi-tenant, multi-lingual, multi-currency platform for NGOs worldwide.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vashundhara Foundation'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vashundhara Foundation',
    description: 'Enterprise-grade multi-tenant, multi-lingual, multi-currency platform for NGOs worldwide.',
    images: ['/og-image.png'],
    creator: '@vashundhara'
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png'
  },
  manifest: '/site.webmanifest',
  verification: {
    google: 'google-site-verification-code'
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}