/**
 * Auth types for Vashundhara Foundation Platform
 */

import type { User, Tenant, Role, Permission } from '@vashundhara-foundation/shared';

export interface JWTPayload {
  sub: string; // user id
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  tenantSlug?: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  tenantSlug?: string;
  tenantName?: string;
}

export interface PasswordResetRequest {
  email: string;
  redirectUrl?: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface EmailVerificationRequest {
  email: string;
}

export interface EmailVerificationConfirm {
  token: string;
}

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerifyRequest {
  code: string;
  backupCode?: boolean;
}

export interface SessionData {
  id: string;
  userId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export interface AuthContext {
  user: User;
  tenant: Tenant;
  roles: Role[];
  permissions: Permission[];
  session: SessionData;
}

export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  iconUrl?: string;
  enabled: boolean;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
  provider: string;
}

export interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
}

export type AuthEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'EMAIL_VERIFIED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED';

export interface AuthEvent {
  type: AuthEventType;
  userId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface RateLimitConfig {
  max: number;
  windowMs: number;
  keyPrefix: string;
}

export const AUTH_RATE_LIMITS: Record<string, RateLimitConfig> = {
  login: { max: 5, windowMs: 900000, keyPrefix: 'auth:login' }, // 5 per 15 min
  register: { max: 3, windowMs: 900000, keyPrefix: 'auth:register' }, // 3 per 15 min
  passwordReset: { max: 2, windowMs: 3600000, keyPrefix: 'auth:password-reset' }, // 2 per hour
  emailVerification: { max: 3, windowMs: 3600000, keyPrefix: 'auth:email-verification' }, // 3 per hour
  mfaVerify: { max: 10, windowMs: 300000, keyPrefix: 'auth:mfa-verify' }, // 10 per 5 min
  tokenRefresh: { max: 20, windowMs: 60000, keyPrefix: 'auth:token-refresh' } // 20 per min
};