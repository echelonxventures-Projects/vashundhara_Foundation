import { Metadata } from 'next'
import { PublicLayout } from '@/components/layout/public-layout'
import { Hero } from './_components/hero'
import { Features } from './_components/features'
import { Stats } from './_components/stats'
import { Testimonials } from './_components/testimonials'
import { CTA } from './_components/cta'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: 'home.title',
    description: 'home.description',
    openGraph: {
      title: 'home.ogTitle',
      description: 'home.ogDescription'
    }
  }
}

interface HomePageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params

  return (
    <PublicLayout>
      <Hero locale={locale} />
      <Stats locale={locale} />
      <Features locale={locale} />
      <Testimonials locale={locale} />
      <CTA locale={locale} />
    </PublicLayout>
  )
}