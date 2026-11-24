/**
 * Core type definitions for Vashundhara Foundation Platform
 * Multi-tenant, Multi-lingual, Multi-currency platform
 */

// ============================================
// BRAND CONSTANTS
// ============================================

export const PLATFORM_NAME = 'Vashundhara Foundation';
export const PLATFORM_DOMAIN = 'vashundharafoundation.org';
export const PLATFORM_TAGLINE = "World's First NGO Platform";
export const PLATFORM_TIER = 'White';

// ============================================
// TENANT TYPES
// ============================================

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_SETUP' | 'ARCHIVED';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryDomain?: string;
  status: TenantStatus;
  defaultCurrency: CurrencyCode;
  defaultLocale: LocaleCode;
  supportedCurrencies: CurrencyCode[];
  supportedLocales: LocaleCode[];
  timezone: string;
  settings: TenantSettings;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface TenantSettings {
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    customCss?: string;
  };
  features?: Record<string, boolean>;
  donation?: DonationSettings;
  notifications?: NotificationSettings;
  compliance?: ComplianceSettings;
  integrations?: IntegrationSettings;
  [key: string]: unknown;
}

export interface DonationSettings {
  minAmount?: number;
  maxAmount?: number;
  suggestedAmounts?: number[];
  allowRecurring?: boolean;
  allowAnonymous?: boolean;
  requirePhone?: boolean;
  requireAddress?: boolean;
  taxDeductionEnabled?: boolean;
  taxDeductionText?: string;
}

export interface NotificationSettings {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  webhookEnabled?: boolean;
  donationReceipts?: boolean;
  welcomeEmail?: boolean;
  campaignUpdates?: boolean;
}

export interface ComplianceSettings {
  gdprEnabled?: boolean;
  dataRetentionDays?: number;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  cookiePolicyUrl?: string;
}

export interface IntegrationSettings {
  paymentGateways?: PaymentGatewayConfig[];
  crm?: CrmConfig;
  emailService?: EmailServiceConfig;
  smsService?: SmsServiceConfig;
}

export interface PaymentGatewayConfig {
  provider: 'razorpay' | 'stripe' | 'paypal' | 'phonepe' | 'cashfree';
  isEnabled: boolean;
  config: Record<string, unknown>;
  supportedCurrencies: CurrencyCode[];
  supportedCountries: string[];
}

export interface CrmConfig {
  provider: 'salesforce' | 'hubspot' | 'zoho' | 'custom';
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export interface EmailServiceConfig {
  provider: 'sendgrid' | 'mailgun' | 'ses' | 'postmark' | 'smtp';
  isEnabled: boolean;
  config: Record<string, unknown>;
}

export interface SmsServiceConfig {
  provider: 'twilio' | 'msg91' | 'gupshup' | 'custom';
  isEnabled: boolean;
  config: Record<string, unknown>;
}

// ============================================
// USER TYPES
// ============================================

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'DELETED';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  phone?: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  locale: LocaleCode;
  timezone: string;
  status: UserStatus;
  lastLoginAt?: Date;
  metadata: Record<string, unknown>;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// RBAC TYPES
// ============================================

export type RoleScope = 'SYSTEM' | 'TENANT';
export type PermissionAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'MANAGE' | 'EXPORT' | 'IMPORT';

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  scope: RoleScope;
  isSystem: boolean;
  priority: number;
  metadata: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Permission {
  id: string;
  resource: string;
  action: PermissionAction;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  conditions?: Record<string, unknown>;
  createdAt: Date;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedBy?: string;
  assignedAt: Date;
  expiresAt?: Date;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  category: string;
  isPublic: boolean;
  isEditable: boolean;
  validationSchema?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantConfig {
  id: string;
  tenantId: string;
  key: string;
  value: unknown;
  description?: string;
  category: string;
  isOverridden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type FeatureFlagType = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'JSON';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string;
  type: FeatureFlagType;
  defaultValue: unknown;
  isEnabled: boolean;
  rolloutPercentage: number;
  targetingRules?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================
// I18N TYPES
// ============================================

export type LocaleCode =
  | 'en' | 'hi' | 'bn' | 'ta' | 'te'
  | 'mr' | 'gu' | 'kn' | 'ml' | 'or'
  | 'pa' | 'as' | 'ur';

export interface Locale {
  id: string;
  code: LocaleCode;
  name: string;
  nativeName: string;
  rtl: boolean;
  dateFormat: string;
  timeFormat: string;
  numberFormat: Record<string, unknown>;
  pluralRules: Record<string, unknown>;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Translation {
  id: string;
  namespace: string;
  key: string;
  value: string;
  context?: string;
  isReviewed: boolean;
  tenantId?: string;
  localeId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TranslationNamespace {
  [key: string]: string | TranslationNamespace;
}

// ============================================
// CURRENCY TYPES
// ============================================

export type CurrencyCode =
  | 'USD' | 'INR' | 'EUR' | 'GBP' | 'JPY'
  | 'CAD' | 'AUD' | 'SGD' | 'AED' | 'SAR';

export interface Currency {
  id: string;
  code: CurrencyCode;
  symbol: string;
  symbolPosition: 'prefix' | 'suffix';
  decimals: number;
  name: string;
  namePlural: string;
  isActive: boolean;
  isBase: boolean;
  formatting: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeRate {
  id: string;
  baseCurrencyId: string;
  targetCurrencyId: string;
  rate: number; // Decimal as number for JS
  source: string;
  fetchedAt: Date;
  validFrom: Date;
  validUntil?: Date;
  isManual: boolean;
  tenantId?: string;
}

export interface Money {
  amount: number; // Minor units (paise for INR, cents for USD)
  currency: CurrencyCode;
}

export interface FormattedMoney {
  amount: string; // Formatted with symbol
  currency: CurrencyCode;
  locale: LocaleCode;
}

// ============================================
// AUDIT TYPES
// ============================================
export interface AuditLog {
  id: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  resourceType?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  tenantId: string;
  userId?: string;
  createdAt: Date;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

// NotificationChannel and NotificationStatus are now defined in constants/notification-channels.ts and constants/notification-status.ts
import type { AuditAction } from '../constants/audit-actions';
import type { NotificationChannel } from '../constants/notification-channels';
import type { NotificationStatus } from '../constants/notification-status';

export interface NotificationTemplate {
  id: string;
  key: string;
  name: string;
  description?: string;
  channel: NotificationChannel;
  subject?: string;
  content: string;
  contentHtml?: string;
  locale: LocaleCode;
  variables: Array<{ name: string; type: string; required: boolean }>;
  isActive: boolean;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  templateId?: string;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  content: string;
  contentHtml?: string;
  status: NotificationStatus;
  priority: number;
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  metadata: Record<string, unknown>;
  tenantId: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export type WebhookEvent =
  | 'TENANT_CREATED' | 'TENANT_UPDATED' | 'TENANT_DELETED'
  | 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED'
  | 'DONATION_CREATED' | 'DONATION_COMPLETED' | 'DONATION_FAILED' | 'DONATION_REFUNDED'
  | 'SUBSCRIPTION_CREATED' | 'SUBSCRIPTION_UPDATED' | 'SUBSCRIPTION_CANCELLED'
  | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED'
  | 'INVOICE_GENERATED' | 'INVOICE_PAID' | 'INVOICE_OVERDUE';

export type WebhookStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  headers: Record<string, string>;
  metadata: Record<string, unknown>;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: unknown;
  responseStatus?: number;
  responseBody?: string;
  status: WebhookStatus;
  attempt: number;
  error?: string;
  nextRetryAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// FILE TYPES
// ============================================

export interface File {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  bucket: string;
  checksum: string;
  metadata: Record<string, unknown>;
  isPublic: boolean;
  expiresAt?: Date;
  tenantId: string;
  uploadedById?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ResponseMeta {
  timestamp: string;
  requestId: string;
  version: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface CursorPaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & {
    pagination: {
      cursor?: string;
      limit: number;
      total?: number;
      hasNext: boolean;
    };
  };
}

// ============================================
// QUERY TYPES
// ============================================

export interface QueryOptions {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, unknown>;
  fields?: string[];
  search?: string;
}

export interface FilterOperator {
  eq?: unknown;
  neq?: unknown;
  gt?: unknown;
  gte?: unknown;
  lt?: unknown;
  lte?: unknown;
  in?: unknown[];
  nin?: unknown[];
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  isNull?: boolean;
}

export interface FilterGroup {
  AND?: FilterGroup[];
  OR?: FilterGroup[];
  NOT?: FilterGroup;
  [field: string]: FilterOperator | FilterGroup | FilterGroup[] | undefined;
}

// ============================================
// TENANT CONTEXT
// ============================================

export interface TenantContext {
  tenantId: string;
  tenant: Tenant;
  userId?: string;
  user?: User;
  roles: string[];
  permissions: string[];
  locale: LocaleCode;
  currency: CurrencyCode;
  timezone: string;
  isSystemAdmin: boolean;
  isTenantAdmin: boolean;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};

export type SoftDeletable = {
  deletedAt?: Date;
};

export type Identifiable = {
  id: string;
};

// ============================================
// CONSTANTS
// ============================================

// Type-only exports for constants (values are defined in domain modules)
// These are re-exported from currency/currency.ts and i18n/i18n.ts
export { CURRENCY_DECIMALS, CURRENCY_SYMBOLS, CURRENCY_NAMES, SUPPORTED_CURRENCIES, LOCALE_CURRENCY_MAP } from '../currency/currency';
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES, LOCALE_FLAGS, DATE_FORMATS, TIME_FORMATS, NUMBER_FORMATS, PLURAL_RULES, TRANSLATION_NAMESPACES } from '../i18n/i18n';

export const SYSTEM_ROLES = [
  'super_admin',
  'system_admin',
  'support_agent'
] as const;

export const TENANT_ROLES = [
  'tenant_admin',
  'manager',
  'member',
  'viewer',
  'donor',
  'volunteer'
] as const;

export const ALL_ROLES = [...SYSTEM_ROLES, ...TENANT_ROLES] as const;

export type SystemRole = typeof SYSTEM_ROLES[number];
export type TenantRole = typeof TENANT_ROLES[number];
export type AnyRole = typeof ALL_ROLES[number];