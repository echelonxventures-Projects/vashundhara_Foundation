'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Star, Quote } from 'lucide-react'
import { useState, useCallback } from 'react'

const testimonials = [
  {
    quote: 'testimonials.1.quote',
    author: 'testimonials.1.author',
    role: 'testimonials.1.role',
    org: 'testimonials.1.org',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya'
  },
  {
    quote: 'testimonials.2.quote',
    author: 'testimonials.2.author',
    role: 'testimonials.2.role',
    org: 'testimonials.2.org',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rajesh'
  },
  {
    quote: 'testimonials.3.quote',
    author: 'testimonials.3.author',
    role: 'testimonials.3.role',
    org: 'testimonials.3.org',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=anita'
  },
  {
    quote: 'testimonials.4.quote',
    author: 'testimonials.4.author',
    role: 'testimonials.4.role',
    org: 'testimonials.4.org',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amit'
  },
  {
    quote: 'testimonials.5.quote',
    author: 'testimonials.5.author',
    role: 'testimonials.5.role',
    org: 'testimonials.5.org',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sunita'
  },
  {
    quote: 'testimonials.6.quote',
    author: 'testimonials.6.author',
    role: 'testimonials.6.role',
    org: 'testimonials.6.org',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=vikram'
  }
]

export function Testimonials({ locale }: { locale: string }) {
  const t = useTranslations('testimonials')
  const [currentIndex, setCurrentIndex] = useState(0)
  const itemsPerView = 3

  const next = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % (testimonials.length - itemsPerView + 1))
  }, [])

  const prev = useCallback(() => {
    setCurrentIndex(prev => (prev - 1 + (testimonials.length - itemsPerView + 1)) % (testimonials.length - itemsPerView + 1))
  }, [])

  const visibleTestimonials = testimonials.slice(currentIndex, currentIndex + itemsPerView)

  return (
    <section className="py-20 lg:py-28 bg-muted/30" aria-labelledby="testimonials-title">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="testimonials-title" className="mb-4 text-3xl lg:text-4xl font-bold tracking-tight">
            {t('title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('description')}
          </p>
        </div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {visibleTestimonials.map((testimonial, index) => (
              <Card
                key={testimonial.author}
                className="h-full transition-all hover:shadow-xl border-border/50 bg-background/80 backdrop-blur-sm"
              >
                <CardContent className="p-6 h-full flex flex-col">
                  <div className="flex gap-1 mb-4" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className="h-5 w-5 text-yellow-400 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                  <Quote className="h-8 w-8 text-primary/20 mb-4" aria-hidden="true" />
                  <blockquote className="text-lg text-foreground mb-6 flex-1">
                    {t(testimonial.quote)}
                  </blockquote>
                  <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={testimonial.avatar} alt="" />
                      <AvatarFallback>{testimonial.author.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{t(testimonial.author)}</p>
                      <p className="text-sm text-muted-foreground">{t(testimonial.role)}</p>
                      <p className="text-xs text-muted-foreground">{t(testimonial.org)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Navigation Arrows */}
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={prev}
              className="p-2 rounded-full bg-background border border-border hover:bg-accent transition-colors"
              aria-label={t('previous')}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2" aria-label="Slide indicators">
              {Array.from({ length: testimonials.length - itemsPerView + 1 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    'h-2 w-2 rounded-full transition-all',
                    i === currentIndex ? 'bg-primary w-6' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                  aria-label={t('goToSlide', { slide: i + 1 })}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="p-2 rounded-full bg-background border border-border hover:bg-accent transition-colors"
              aria-label={t('next')}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}