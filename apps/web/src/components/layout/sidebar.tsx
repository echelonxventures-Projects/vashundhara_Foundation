'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  HeartHandshake,
  Target,
  Users,
  BarChart,
  Settings,
  FileText,
  CreditCard,
  Bell,
  Shield,
  Globe,
  Key,
  Database,
  Zap,
  Menu,
  X,
  ChevronRight,
  ChevronDown
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from '@/components/ui/collapsible'
import { useTenant, useTenantContext } from '@/components/providers/tenant-provider'
import { useAuth } from '@/components/providers/auth-provider'

const navigation = [
  {
    key: 'dashboard',
    label: 'nav.dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['tenant_admin', 'manager', 'member', 'viewer']
  },
  {
    key: 'donations',
    label: 'nav.donations',
    href: '/donations',
    icon: HeartHandshake,
    roles: ['tenant_admin', 'manager', 'member']
  },
  {
    key: 'campaigns',
    label: 'nav.campaigns',
    href: '/campaigns',
    icon: Target,
    roles: ['tenant_admin', 'manager', 'member']
  },
  {
    key: 'donors',
    label: 'nav.donors',
    href: '/donors',
    icon: Users,
    roles: ['tenant_admin', 'manager']
  },
  {
    key: 'reports',
    label: 'nav.reports',
    href: '/reports',
    icon: BarChart,
    roles: ['tenant_admin', 'manager']
  },
  {
    key: 'subscriptions',
    label: 'nav.subscriptions',
    href: '/subscriptions',
    icon: CreditCard,
    roles: ['tenant_admin', 'manager']
  }
] as const

const adminNavigation = [
  {
    key: 'users',
    label: 'nav.users',
    href: '/admin/users',
    icon: Users,
    roles: ['tenant_admin']
  },
  {
    key: 'roles',
    label: 'nav.roles',
    href: '/admin/roles',
    icon: Shield,
    roles: ['tenant_admin']
  },
  {
    key: 'settings',
    label: 'nav.settings',
    href: '/admin/settings',
    icon: Settings,
    roles: ['tenant_admin']
  },
  {
    key: 'feature-flags',
    label: 'nav.featureFlags',
    href: '/admin/feature-flags',
    icon: Zap,
    roles: ['tenant_admin']
  },
  {
    key: 'webhooks',
    label: 'nav.webhooks',
    href: '/admin/webhooks',
    icon: Globe,
    roles: ['tenant_admin']
  },
  {
    key: 'audit-logs',
    label: 'nav.auditLogs',
    href: '/admin/audit-logs',
    icon: FileText,
    roles: ['tenant_admin']
  },
  {
    key: 'api-keys',
    label: 'nav.apiKeys',
    href: '/admin/api-keys',
    icon: Key,
    roles: ['tenant_admin']
  },
  {
    key: 'database',
    label: 'nav.database',
    href: '/admin/database',
    icon: Database,
    roles: ['tenant_admin']
  }
] as const

type NavItem = typeof navigation[number]
type AdminNavItem = typeof adminNavigation[number]

function NavLink({ item, pathname, t, isCollapsed }: {
  item: NavItem | AdminNavItem
  pathname: string
  t: ReturnType<typeof useTranslations>
  isCollapsed: boolean
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        isCollapsed && 'justify-center px-2'
      )}
      title={isCollapsed ? t(item.label) : undefined}
      aria-label={isCollapsed ? t(item.label) : undefined}
    >
      <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      {!isCollapsed && <span>{t(item.label)}</span>}
    </Link>
  )
}

function NavSection({ title, items, pathname, t, isCollapsed }: {
  title: string
  items: (NavItem | AdminNavItem)[]
  pathname: string
  t: ReturnType<typeof useTranslations>
  isCollapsed: boolean
}) {
  return (
    <nav aria-label={title}>
      {!isCollapsed && (
        <h4 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t(title)}
        </h4>
      )}
      <ul className="space-y-1" role="list">
        {items.map((item) => (
          <li key={item.key}>
            <NavLink item={item} pathname={pathname} t={t} isCollapsed={isCollapsed} />
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const t = useTranslations('sidebar')
  const { user } = useAuth()
  const { tenant } = useTenant()
  const tenantContext = useTenantContext()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const userRoles = tenantContext?.roles || []
  const isTenantAdmin = userRoles.includes('tenant_admin')
  const isManager = userRoles.includes('manager')

  const filteredNavigation = navigation.filter(item =>
    item.roles.some(role => userRoles.includes(role))
  )

  const filteredAdminNavigation = adminNavigation.filter(item =>
    item.roles.some(role => userRoles.includes(role))
  )

  const toggleCollapse = () => setIsCollapsed(!isCollapsed)

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] bg-card border-r border-border transition-all duration-300 ease-in-out lg:relative lg:z-auto lg:h-[calc(100vh-4rem)]',
          isCollapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main sidebar navigation"
      >
        <div className="flex h-full flex-col overflow-y-auto p-3">
          {/* Tenant Info */}
          {!isCollapsed && tenant && (
            <div className="mb-6 px-2 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="font-bold text-lg">
                    {tenant.displayName?.[0] || tenant.name[0] || 'V'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{tenant.displayName || tenant.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{tenant.slug}</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Navigation */}
          <NavSection
            title={t('sections.main')}
            items={filteredNavigation}
            pathname={pathname}
            t={t}
            isCollapsed={isCollapsed}
          />

          {/* Admin Navigation */}
          {(isTenantAdmin || isManager) && filteredAdminNavigation.length > 0 && (
            <>
              <div className="my-4 border-t border-border" />
              <NavSection
                title={t('sections.admin')}
                items={filteredAdminNavigation}
                pathname={pathname}
                t={t}
                isCollapsed={isCollapsed}
              />
            </>
          )}

          {/* Collapse Toggle */}
          <div className="mt-auto pt-4">
            <Button
              variant="ghost"
              size="icon"
              className={cn('w-full mx-auto', isCollapsed && 'rotate-180')}
              onClick={toggleCollapse}
              aria-label={isCollapsed ? t('expand') : t('collapse')}
              aria-expanded={!isCollapsed}
            >
              <ChevronRight className="h-5 w-5 transition-transform duration-200" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Toggle Button */}
      <button
        type="button"
        className="fixed bottom-6 left-6 z-50 lg:hidden rounded-full bg-primary p-3 text-primary-foreground shadow-lg"
        onClick={() => setMobileOpen(true)}
        aria-label={t('openMenu')}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Mobile Close Button */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed top-20 left-6 z-50 lg:hidden rounded-full bg-card p-2 text-foreground shadow-lg border border-border"
          onClick={() => setMobileOpen(false)}
          aria-label={t('closeMenu')}
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </>
  )
}