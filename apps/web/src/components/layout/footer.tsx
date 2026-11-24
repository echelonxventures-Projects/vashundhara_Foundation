'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Heart, Twitter, Linkedin, Github, Globe } from 'lucide-react'
import { LOCALE_NAMES, LOCALE_FLAGS } from '@vashundhara-foundation/i18n'
import { cn } from '@/lib/utils'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const PLATFORM_NAME = 'Vashundhara Foundation'
const PLATFORM_DOMAIN = 'vashundharafoundation.org'

const footerLinks = {
  product: [
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Integrations', href: '/integrations' },
    { label: 'API Docs', href: '/docs/api' },
    { label: 'Changelog', href: '/changelog' }
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Contact', href: '/contact' }
  ],
  resources: [
    { label: 'Documentation', href: '/docs' },
    { label: 'Community', href: '/community' },
    { label: 'Help Center', href: '/help' },
    { label: 'Status', href: '/status' },
    { label: 'Security', href: '/security' }
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'GDPR', href: '/gdpr' }
  ]
}

const socialLinks = [
  { icon: Twitter, href: 'https://twitter.com/vashundhara', label: 'Twitter' },
  { icon: Linkedin, href: 'https://linkedin.com/company/vashundhara', label: 'LinkedIn' },
  { icon: Github, href: 'https://github.com/vashundhara', label: 'GitHub' },
  { icon: Globe, href: 'https://vashundharafoundation.org', label: 'Website' }
]

export function Footer() {
  const locale = useLocale()
  const t = useTranslations('footer')

  return (
    <footer className="border-t border-border bg-muted/30" role="contentinfo">
      <div className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-6">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href={`/${locale}`} className="flex items-center gap-2" aria-label={t('brand.home')}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-xl font-bold">V</span>
              </div>
              <span className="font-semibold text-xl">{PLATFORM_NAME}</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              {t('brand.description')}
            </p>
            <div className="mt-6 flex gap-4">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={label}
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <nav aria-label="Product">
            <h3 className="text-sm font-semibold">{t('links.product')}</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={`/${locale}${link.href}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company Links */}
          <nav aria-label="Company">
            <h3 className="text-sm font-semibold">{t('links.company')}</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={`/${locale}${link.href}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resources Links */}
          <nav aria-label="Resources">
            <h3 className="text-sm font-semibold">{t('links.resources')}</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    href={`/${locale}${link.href}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal Links */}
          <nav aria-label="Legal">
            <h3 className="text-sm font-semibold">{t('links.legal')}</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={`/${locale}${link.href}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} {PLATFORM_NAME}. {t('copyright.rightsReserved')}
          </p>

          {/* Locale Selector in Footer */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Globe className="h-4 w-4" />
                <span>{LOCALE_FLAGS[locale as keyof typeof LOCALE_FLAGS] || '🌐'}</span>
                <span className="capitalize">{locale}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {Object.entries(LOCALE_NAMES).map(([code, { native }]) => (
                <DropdownMenuItem
                  key={code}
                  onSelect={() => window.location.href = window.location.pathname.replace(/^\/[a-z]{2}/, `/${code}`)}
                  className={cn('flex items-center gap-2', locale === code && 'font-medium text-primary')}
                >
                  {LOCALE_FLAGS[code as keyof typeof LOCALE_FLAGS]}
                  <span>{native}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Made with love */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            Made with <Heart className="h-3 w-3 text-red-500" /> for NGOs worldwide
          </p>
        </div>
      </div>
    </footer>
  )
}