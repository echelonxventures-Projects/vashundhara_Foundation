'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'
import { Menu, X, Sun, Moon, Globe, Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth, useUser } from '@/components/providers/auth-provider'
import { useTenant, useTenantSettings } from '@/components/providers/tenant-provider'
import { LOCALE_NAMES, LOCALE_FLAGS } from '@vashundhara-foundation/i18n'

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('header')
  const { logout, isAuthenticated } = useAuth()
  const user = useUser()
  const { tenant, isLoading: tenantLoading } = useTenant()
  const settings = useTenantSettings()
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = stored || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    document.documentElement.classList.toggle('dark', initialTheme === 'dark')
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
  }

  const handleLocaleChange = (newLocale: string) => {
    const path = pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?/, '')
    router.push(`/${newLocale}${path}`)
  }

  const handleLogout = async () => {
    await logout()
    router.push(`/${locale}/login`)
  }

  const navigation = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: 'layout-dashboard' },
    { href: '/donations', label: t('nav.donations'), icon: 'heart-handshake' },
    { href: '/campaigns', label: t('nav.campaigns'), icon: 'target' },
    { href: '/reports', label: t('nav.reports'), icon: 'bar-chart' },
    { href: '/settings', label: t('nav.settings'), icon: 'settings' }
  ]

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200',
        isScrolled
          ? 'bg-background/95 backdrop-blur-sm shadow-sm border-b border-border'
          : 'bg-transparent'
      )}
    >
      <nav className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8" aria-label="Main navigation">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <button
              type="button"
              className="lg:hidden p-2 -ml-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            <Link href={`/${locale}`} className="flex items-center gap-2" aria-label={t('brand.home')}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-lg font-bold">V</span>
              </div>
              <span className="hidden font-semibold text-xl sm:block">
                {tenant?.displayName || tenant?.name || 'Vashundhara Foundation'}
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:gap-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={`/${locale}${item.href}`}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  pathname === `/${locale}${item.href}`
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Locale Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <span className="flex items-center gap-1">
                    {LOCALE_FLAGS[locale as keyof typeof LOCALE_FLAGS] || '🌐'}
                    <span className="hidden sm:inline">{locale.toUpperCase()}</span>
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{t('language.select')}</DropdownMenuLabel>
                {Object.entries(LOCALE_NAMES).map(([code, { native }]) => (
                  <DropdownMenuItem
                    key={code}
                    onSelect={() => handleLocaleChange(code)}
                    className={cn(
                      'flex items-center gap-2',
                      locale === code && 'font-medium text-primary'
                    )}
                  >
                    {LOCALE_FLAGS[code as keyof typeof LOCALE_FLAGS]}
                    <span>{native}</span>
                    {locale === code && <span className="ml-auto text-primary">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? t('theme.dark') : t('theme.light')}
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                3
              </span>
            </Button>

            {/* User Menu */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.email} />
                      <AvatarFallback>{user.displayName?.[0] || user.email[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl || undefined} alt={user.displayName || user.email} />
                      <AvatarFallback>{user.displayName?.[0] || user.email[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.displayName || user.email}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/profile`} onClick={() => router.push(`/${locale}/profile`)}>
                      <User className="mr-2 h-4 w-4" />
                      {t('user.profile')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${locale}/settings`} onClick={() => router.push(`/${locale}/settings`)}>
                      <Settings className="mr-2 h-4 w-4" />
                      {t('user.settings')}
                    </Link>
                  </DropdownMenuItem>
                  {tenant && (
                    <DropdownMenuItem asChild>
                      <Link href={`/${locale}/admin/tenant`} onClick={() => router.push(`/${locale}/admin/tenant`)}>
                        <Globe className="mr-2 h-4 w-4" />
                        {t('user.tenantSettings')}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('user.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden lg:flex lg:items-center lg:gap-2">
                <Link href={`/${locale}/login`}>
                  <Button variant="ghost" size="sm">{t('auth.login')}</Button>
                </Link>
                <Link href={`/${locale}/register`}>
                  <Button size="sm">{t('auth.register')}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-2">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={`/${locale}${item.href}`}
                  className={cn(
                    'px-3 py-2 text-base font-medium rounded-md',
                    pathname === `/${locale}${item.href}`
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <div className="flex flex-col gap-2 pt-2 border-t border-border">
                  <Link href={`/${locale}/login`} onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">{t('auth.login')}</Button>
                  </Link>
                  <Link href={`/${locale}/register`} onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">{t('auth.register')}</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}