'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Tenant, TenantContext } from '@vashundhara-foundation/shared'

interface TenantProviderContext {
  tenant: Tenant | null
  tenantContext: TenantContext | null
  isLoading: boolean
  error: Error | null
  refreshTenant: () => Promise<void>
}

const TenantContext = createContext<TenantProviderContext | undefined>(undefined)

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchTenant = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/tenant/current', {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tenant')
      }

      const data = await response.json()
      setTenant(data.tenant)
      setTenantContext(data.context)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setTenant(null)
      setTenantContext(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTenant()
  }, [])

  const refreshTenant = async () => {
    await fetchTenant()
  }

  return (
    <TenantContext.Provider
      value={{
        tenant,
        tenantContext,
        isLoading,
        error,
        refreshTenant
      }}
    >
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

export function useTenantContext() {
  const { tenantContext } = useTenant()
  return tenantContext
}

export function useTenantId() {
  const { tenant } = useTenant()
  return tenant?.id
}

export function useTenantSlug() {
  const { tenant } = useTenant()
  return tenant?.slug
}

export function useTenantSettings() {
  const { tenant } = useTenant()
  return tenant?.settings || {}
}

export function useTenantCurrency() {
  const { tenantContext } = useTenant()
  return tenantContext?.currency || 'INR'
}

export function useTenantLocale() {
  const { tenantContext } = useTenant()
  return tenantContext?.locale || 'en'
}