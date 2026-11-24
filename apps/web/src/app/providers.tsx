'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { trpc, trpcClient } from '@/lib/trpc/client'
import { useState, useEffect, ReactNode } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { TenantProvider } from '@/components/providers/tenant-provider'
import { AuthProvider } from '@/components/providers/auth-provider'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1
          }
        }
      })
  )

  const [trpcContext] = useState(() => trpcClient)

  // Initialize theme on client
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = stored || (prefersDark ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcContext} queryClient={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TenantProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </TenantProvider>
        </ThemeProvider>
      </trpc.Provider>
      <ReactQueryDevtools initialIsOpen={false} />
      <Toaster />
    </QueryClientProvider>
  )
}