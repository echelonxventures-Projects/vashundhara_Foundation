'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Sparkles, Shield, Globe, Languages, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const benefits = [
  { icon: Sparkles, title: 'cta.benefits.freeTrial', description: 'cta.benefits.freeTrialDesc' },
  { icon: Shield, title: 'cta.benefits.secure', description: 'cta.benefits.secureDesc' },
  { icon: Globe, title: 'cta.benefits.multiTenant', description: 'cta.benefits.multiTenantDesc' },
  { icon: Languages, title: 'cta.benefits.i18n', description: 'cta.benefits.i18nDesc' },
  { icon: DollarSign, title: 'cta.benefits.multiCurrency', description: 'cta.benefits.multiCurrencyDesc' },
  { icon: ArrowRight, title: 'cta.benefits.cancelAnytime', description: 'cta.benefits.cancelAnytimeDesc' }
]

export function CTA({ locale }: { locale: string }) {
  const t = useTranslations('cta')

  return (
    <section className="py-20 lg:py-28" aria-labelledby="cta-title">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 p-8 lg:p-16 text-center overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-foreground/10 via-transparent to-transparent" aria-hidden="true" />

          <div className="relative max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-primary-foreground text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {t('badge')}
            </div>

            <h2 id="cta-title" className="mb-6 text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight text-primary-foreground">
              {t('title')}
            </h2>

            <p className="mb-10 text-lg lg:text-xl text-primary-foreground/90 max-w-2xl mx-auto">
              {t('description')}
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row mb-12">
              <Link href={`/${locale}/register`}>
                <Button size="lg" className="w-full sm:w-auto gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90" asChild>
                  <span>{t('cta.primary')}</span>
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href={`/${locale}/demo`}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                  {t('cta.secondary')}
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-left">
              {benefits.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <div key={benefit.title} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground flex-shrink-0">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-medium text-primary-foreground">{t(benefit.title)}</p>
                      <p className="text-sm text-primary-foreground/70">{t(benefit.description)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground mb-6">{t('trustedBy')}</p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-40 hover:opacity-100 transition-opacity">
            <span className="text-sm font-medium text-muted-foreground">NGO India</span>
            <span className="text-sm font-medium text-muted-foreground">GiveIndia</span>
            <span className="text-sm font-medium text-muted-foreground">Charities Aid Foundation</span>
            <span className="text-sm font-medium text-muted-foreground">GlobalGiving</span>
            <span className="text-sm font-medium text-muted-foreground">Ketto</span>
            <span className="text-sm font-medium text-muted-foreground">Milaap</span>
          </div>
        </div>
      </div>
    </section>
  )
}