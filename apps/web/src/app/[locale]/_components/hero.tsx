'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle, Globe, Languages, DollarSign, Shield, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const features = [
  { icon: Globe, key: 'multiTenant' },
  { icon: Languages, key: 'multiLingual' },
  { icon: DollarSign, key: 'multiCurrency' },
  { icon: Shield, key: 'secure' },
  { icon: Users, key: 'collaborative' },
  { icon: CheckCircle, key: 'compliant' }
]

export function Hero({ locale }: { locale: string }) {
  const t = useTranslations('hero')

  return (
    <section className="relative overflow-hidden py-20 lg:py-32" aria-labelledby="hero-title">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" aria-hidden="true" />

      <div className="relative mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {t('badge')}
          </div>

          <h1 id="hero-title" className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {t('titlePart1')}
            <br />
            <span className="text-primary">{t('titlePart2')}</span>
          </h1>

          <p className="mb-8 text-lg text-muted-foreground max-w-2xl mx-auto sm:text-xl">
            {t('description')}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href={`/${locale}/register`}>
              <Button size="lg" className="w-full sm:w-auto gap-2" asChild>
                <span>{t('cta.primary')}</span>
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href={`/${locale}/demo`}>
              <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
                {t('cta.secondary')}
              </Button>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            {features.map(({ icon: Icon, key }) => (
              <div key={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{t(`features.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Preview */}
        <div className="mt-16 relative">
          <div className="relative aspect-video max-w-5xl mx-auto rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" aria-hidden="true" />
            <div className="relative p-6 h-full flex flex-col justify-end">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mx-auto">
                <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <HeartHandshake className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold">₹2,45,67,890</p>
                        <p className="text-sm text-muted-foreground">{t('preview.totalRaised')}</p>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '78%' }} />
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold">12,847</p>
                        <p className="text-sm text-muted-foreground">{t('preview.activeDonors')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span>+23% this month</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <Target className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-semibold">24</p>
                        <p className="text-sm text-muted-foreground">{t('preview.activeCampaigns')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">{t('preview.completed')}</p>
                        <p className="font-semibold">18</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('preview.inProgress')}</p>
                        <p className="font-semibold">6</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Import missing icons
import { HeartHandshake, TrendingUp, Target } from 'lucide-react'