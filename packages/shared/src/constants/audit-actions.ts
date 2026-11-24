/**
 * Audit Action Constants
 */

export const AUDIT_ACTIONS = [
  'CREATE', 'READ', 'UPDATE', 'DELETE',
  'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT',
  'FAILED_LOGIN', 'PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'CONFIG_CHANGE'
] as const;

export const AUDIT_ACTION_VALUES = [...AUDIT_ACTIONS] as const;

export type AuditAction = typeof AUDIT_ACTIONS[number];