'use client'

import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink, loggerLink } from '@trpc/client'
import { transformer } from './transformer'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { AppRouter } from '@vashundhara-foundation/shared'

export const trpc = createTRPCReact<any>()

function getBaseUrl() {
  if (typeof window !== 'undefined') return ''
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export const trpcClient = trpc.createClient({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === 'development' ||
        (opts.direction === 'down' && opts.result instanceof Error)
    }),
    httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer,
      headers() {
        const headers: Record<string, string> = {}
        if (typeof window !== 'undefined') {
          const tenantId = document.cookie
            .split('; ')
            .find(row => row.startsWith('tenant_id='))
            ?.split('=')[1]
          if (tenantId) headers['x-tenant-id'] = tenantId
        }
        return headers
      },
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include'
        })
      }
    })
  ]
})