'use client'

import { useTranslations } from 'next-intl'
import { HeartHandshake, Users, Target, Award, TrendingUp, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const stats = [
  { icon: HeartHandshake, value: '₹500Cr+', label: 'stats.totalRaised', description: 'stats.acrossPlatform' },
  { icon: Users, value: '2.5L+', label: 'stats.activeDonors', description: 'stats.worldwide' },
  { icon: Target, value: '1,200+', label: 'stats.campaigns', description: 'stats.activeCampaigns' },
  { icon: Award, value: '99.9%', label: 'stats.uptime', description: 'stats.guaranteed' },
  { icon: Globe, value: '13', label: 'stats.languages', description: 'stats.supported' },
  { icon: TrendingUp, value: '40%', label: 'stats.avgGrowth', description: 'stats.yearOverYear' }
]

export function Stats({ locale }: { locale: string }) {
  const t = useTranslations('stats')

  return (
    <section className="py-16 bg-muted/30 border-y border-border" aria-label="Platform statistics">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 lg:gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className={cn(
                  'text-center p-6 rounded-xl bg-background border border-border/50 transition-all hover:shadow-lg',
                  index === 0 && 'lg:col-span-2'
                )}
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 mx-auto">
                  <Icon className="h-7 w-7" aria-hidden="true" />
                </div>
                <div className="text-3xl lg:text-4xl font-bold text-foreground mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-foreground mb-1">
                  {t(stat.label)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t(stat.description)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}