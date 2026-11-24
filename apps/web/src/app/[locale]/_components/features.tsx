'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Globe,
  Languages,
  DollarSign,
  Shield,
  Users,
  Zap,
  Database,
  Palette,
  Bell,
  Webhook,
  Key,
  BarChart,
  FileText,
  Settings,
  Layers,
  Cpu,
  Lock
} from 'lucide-react'

const features = [
  {
    icon: Globe,
    category: 'features.categories.multiTenancy',
    items: [
      { key: 'isolatedData', icon: Database },
      { key: 'customDomains', icon: Globe },
      { key: 'whiteLabel', icon: Palette },
      { key: 'sso', icon: Lock }
    ]
  },
  {
    icon: Languages,
    category: 'features.categories.i18n',
    items: [
      { key: '13Locales', icon: Languages },
      { key: 'rtlSupport', icon: Layers },
      { key: 'dynamicTranslations', icon: FileText },
      { key: 'localeDetection', icon: Cpu }
    ]
  },
  {
    icon: DollarSign,
    category: 'features.categories.multiCurrency',
    items: [
      { key: '10Currencies', icon: DollarSign },
      { key: 'liveRates', icon: TrendingUp },
      { key: 'localizedFormatting', icon: Settings },
      { key: 'multiCurrencyDonations', icon: HeartHandshake }
    ]
  },
  {
    icon: Shield,
    category: 'features.categories.security',
    items: [
      { key: 'rbac', icon: Users },
      { key: 'auditLogs', icon: FileText },
      { key: 'mfa', icon: Lock },
      { key: 'gdpr', icon: Shield }
    ]
  },
  {
    icon: Zap,
    category: 'features.categories.extensibility',
    items: [
      { key: 'featureFlags', icon: Zap },
      { key: 'webhooks', icon: Webhook },
      { key: 'apiKeys', icon: Key },
      { key: 'plugins', icon: Layers }
    ]
  },
  {
    icon: BarChart,
    category: 'features.categories.analytics',
    items: [
      { key: 'realtimeDashboards', icon: BarChart },
      { key: 'customReports', icon: FileText },
      { key: 'exportData', icon: FileText },
      { key: 'notifications', icon: Bell }
    ]
  }
]

// Import missing icons
import { HeartHandshake, TrendingUp } from 'lucide-react'

export function Features({ locale }: { locale: string }) {
  const t = useTranslations('features')

  return (
    <section className="py-20 lg:py-28" aria-labelledby="features-title">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="features-title" className="mb-4 text-3xl lg:text-4xl font-bold tracking-tight">
            {t('title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('description')}
          </p>
        </div>

        <div className="space-y-16">
          {features.map((category, catIndex) => (
            <div key={category.category} className={catIndex > 0 ? 'border-t border-border pt-16' : ''}>
              <div className="flex items-center gap-3 mb-8">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <category.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-2xl font-bold">{t(category.category)}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {category.items.map((item, itemIndex) => {
                  const Icon = item.icon
                  return (
                    <Card
                      key={item.key}
                      className="group relative overflow-hidden transition-all hover:shadow-xl border-border/50 bg-background/80 backdrop-blur-sm"
                    >
                      <CardContent className="p-6">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                          <Icon className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <h4 className="font-semibold text-lg mb-2">{t(`items.${item.key}.title`)}</h4>
                        <p className="text-sm text-muted-foreground">{t(`items.${item.key}.description`)}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}