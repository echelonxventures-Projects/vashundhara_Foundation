'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Header } from './header'
import { Footer } from './footer'

interface AuthLayoutProps {
  children: ReactNode
  className?: string
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-background flex flex-col', className)}>
      <Header />

      <main
        id="main-content"
        className="flex-1 flex items-center justify-center px-4 py-12"
        role="main"
      >
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  )
}