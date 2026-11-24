/**
 * MFA (Multi-Factor Authentication) utilities for Vashundhara Foundation Platform
 */

import { authenticator } from 'otplib';

import type { MFASetupResponse } from '../types';

export function generateMFASecret(): string {
  return authenticator.generateSecret();
}

export function getMFAUri(secret: string, email: string, issuer: string = 'Vashundhara Foundation'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

export function generateMFAQRCode(uri: string): string {
  return authenticator.keyuri(uri.split(':')[1]?.replace('?', '') || '', 'Vashundhara Foundation', uri.split('secret=')[1]?.split('&')[0] || '');
}

export function verifyMFAToken(token: string, secret: string): boolean {
  return authenticator.check(token, secret);
}

export function setupMFA(email: string): MFASetupResponse {
  const secret = generateMFASecret();
  const uri = getMFAUri(secret, email);
  const qrCodeUrl = generateMFAQRCode(uri);
  const backupCodes = generateBackupCodes();

  return {
    secret,
    qrCodeUrl,
    backupCodes
  };
}

function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let i = 0; i < count; i++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    codes.push(code);
  }

  return codes;
}

export function verifyBackupCode(code: string, backupCodes: string[]): boolean {
  const normalizedCode = code.toUpperCase().replace(/\s/g, '');
  const index = backupCodes.findIndex(c => c === normalizedCode);

  if (index !== -1) {
    // Remove used backup code
    backupCodes.splice(index, 1);
    return true;
  }

  return false;
}