import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { trpc } from '@/lib/trpc/client'

// Type-safe hook wrappers using trpc
// Full types will be inferred from the API package when it's available

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const t = trpc as any

// Tenant hooks
export function useTenant() {
  return t.tenant.getCurrent.useQuery()
}

export function useTenants(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  return t.tenant.list.useQuery(params)
}

export function useTenantById(id: string) {
  return t.tenant.byId.useQuery(id, { enabled: !!id })
}

export function useCreateTenant() {
  const queryClient = useQueryClient()
  return t.tenant.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: t.tenant.list.queryKey() })
    }
  })
}

export function useUpdateTenant() {
  const queryClient = useQueryClient()
  return t.tenant.update.useMutation({
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: t.tenant.list.queryKey() })
      queryClient.invalidateQueries({ queryKey: t.tenant.byId.queryKey(data.id) })
    }
  })
}

export function useDeleteTenant() {
  const queryClient = useQueryClient()
  return t.tenant.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: t.tenant.list.queryKey() })
    }
  })
}

// User hooks
export function useUser() {
  return t.user.getCurrent.useQuery()
}

export function useUsers(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  return t.user.list.useQuery(params)
}

export function useUserById(id: string) {
  return t.user.byId.useQuery(id, { enabled: !!id })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return t.user.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: t.user.list.queryKey() })
    }
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return t.user.update.useMutation({
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: t.user.list.queryKey() })
      queryClient.invalidateQueries({ queryKey: t.user.byId.queryKey(data.id) })
    }
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  return t.user.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: t.user.list.queryKey() })
    }
  })
}

// Role hooks
export function useRoles(params?: { page?: number; limit?: number; scope?: 'SYSTEM' | 'TENANT' }) {
  return t.role.list.useQuery(params)
}

export function useRoleById(id: string) {
  return t.role.byId.useQuery(id, { enabled: !!id })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return t.role.create.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: t.role.list.queryKey() })
    }
  })
}

// Permission hooks
export function usePermissions() {
  return t.permission.list.useQuery()
}

// Feature Flag hooks
export function useFeatureFlags() {
  return t.featureFlag.list.useQuery()
}

export function useFeatureFlag(key: string) {
  return t.featureFlag.get.useQuery(key, { enabled: !!key })
}

// Currency hooks
export function useCurrencies() {
  return t.currency.list.useQuery()
}

export function useExchangeRate(base: string, target: string) {
  return t.currency.exchangeRate.useQuery({ base, target }, { enabled: !!base && !!target })
}

// i18n hooks
export function useTranslations(namespace: string, locale?: string) {
  return t.i18n.translations.useQuery({ namespace, locale })
}

export function useTranslation(key: string, namespace: string, locale?: string) {
  return t.i18n.translation.useQuery({ key, namespace, locale }, { enabled: !!key })
}

// Audit hooks
export function useAuditLogs(params?: { page?: number; limit?: number; resource?: string; action?: string }) {
  return t.audit.list.useQuery(params)
}

// Notification hooks
export function useNotifications(params?: { page?: number; limit?: number; status?: string }) {
  return t.notification.list.useQuery(params)
}

// File hooks
export function useFiles(params?: { page?: number; limit?: number; mimeType?: string }) {
  return t.file.list.useQuery(params)
}

// Webhook hooks
export function useWebhooks() {
  return t.webhook.list.useQuery()
}