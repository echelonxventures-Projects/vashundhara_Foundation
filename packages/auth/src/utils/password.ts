/**
 * Password utilities for Vashundhara Foundation Platform
 */

import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const PASSWORD_SCHEMA = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const result = PASSWORD_SCHEMA.safeParse(password);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map(e => e.message)
  };
}

export function getPasswordStrength(password: string): {
  score: number;
  label: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong';
  entropy: number;
} {
  // Calculate entropy
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 32;

  const entropy = Math.log2(Math.pow(pool, password.length));

  let score = 0;
  let label: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' = 'very-weak';

  if (entropy < 28) {
    score = 0;
    label = 'very-weak';
  } else if (entropy < 36) {
    score = 1;
    label = 'weak';
  } else if (entropy < 60) {
    score = 2;
    label = 'fair';
  } else if (entropy < 100) {
    score = 3;
    label = 'good';
  } else {
    score = 4;
    label = 'strong';
  }

  return { score, label, entropy };
}

export function checkCommonPasswords(password: string): boolean {
  const commonPasswords = [
    'password', 'password123', '12345678', 'qwerty123', 'admin123',
    'welcome123', 'letmein123', 'monkey123', 'dragon123', 'sunshine123'
  ];

  return commonPasswords.some(p => password.toLowerCase().includes(p));
}

export function generateSecurePassword(length: number = 16): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each required type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];

  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export function needsRehash(hash: string): boolean {
  const rounds = bcrypt.getRounds(hash);
  return rounds < BCRYPT_ROUNDS;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  maxAgeDays: number;
  historyCount: number;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true,
  maxAgeDays: 90,
  historyCount: 5
};

export function createPasswordSchema(policy: Partial<PasswordPolicy> = {}): z.ZodString {
  const merged = { ...DEFAULT_PASSWORD_POLICY, ...policy };
  let schema = z.string()
    .min(merged.minLength, `Password must be at least ${merged.minLength} characters`)
    .max(merged.maxLength, `Password must be at most ${merged.maxLength} characters`);

  if (merged.requireUppercase) {
    schema = schema.regex(/[A-Z]/, 'Password must contain at least one uppercase letter');
  }
  if (merged.requireLowercase) {
    schema = schema.regex(/[a-z]/, 'Password must contain at least one lowercase letter');
  }
  if (merged.requireNumbers) {
    schema = schema.regex(/[0-9]/, 'Password must contain at least one number');
  }
  if (merged.requireSpecialChars) {
    schema = schema.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
  }

  return schema;
}