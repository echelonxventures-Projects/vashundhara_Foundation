'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Header } from './header'
import { Footer } from './footer'

interface PublicLayoutProps {
  children: ReactNode
  className?: string
}

export function PublicLayout({ children, className }: PublicLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      <Header />

      <main id="main-content" className="flex-1" role="main">
        {children}
      </main>

      <Footer />
    </div>
  )
}