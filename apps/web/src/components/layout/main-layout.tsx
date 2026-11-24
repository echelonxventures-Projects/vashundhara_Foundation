'use client'

import { ReactNode, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Header } from './header'
import { Footer } from './footer'
import { Sidebar } from './sidebar'

interface MainLayoutProps {
  children: ReactNode
  showHeader?: boolean
  showFooter?: boolean
  showSidebar?: boolean
  className?: string
}

export function MainLayout({
  children,
  showHeader = true,
  showFooter = true,
  showSidebar = true,
  className
}: MainLayoutProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-16" aria-hidden="true" />
        <div className="flex flex-1">
          <div className="w-64 lg:w-64" aria-hidden="true" />
          <main className="flex-1 p-6" aria-hidden="true">
            <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      {showHeader && <Header />}

      <div className="flex flex-1 relative">
        {showSidebar && <Sidebar />}

        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-y-auto transition-all duration-300',
            showSidebar ? 'lg:pl-64' : 'lg:pl-0',
            showHeader ? 'pt-16' : 'pt-0'
          )}
          role="main"
          tabIndex={-1}
        >
          <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>

      {showFooter && <Footer />}

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Skip to main content
      </a>
    </div>
  )
}