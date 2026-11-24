import { randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import { FieldCipher, generateTotpSecret, hashPassword, passwordProblems, totpAt, verifyPassword, verifyTotp } from './index';

describe('totp', () => {
  it('matches RFC 6238 vectors', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(totpAt(secret, Math.floor(59 / 30))).toBe('287082');
    expect(totpAt(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpAt(secret, Math.floor(20000000000 / 30))).toBe('353130');
  });
  it('rejects wrong and replayed codes', () => {
    const s = generateTotpSecret();
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = totpAt(s, step);
    expect(verifyTotp(s, code, null, now)).toBe(step);
    expect(verifyTotp(s, code, step, now)).toBeNull();
    expect(verifyTotp(s, code === '000000' ? '000001' : '000000', null, now)).toBeNull();
    expect(verifyTotp(s, 'abc', null, now)).toBeNull();
  });
});

describe('password', () => {
  it('enforces policy', () => {
    expect(passwordProblems('1').length).toBeGreaterThan(0);
    expect(passwordProblems('password123')).toContain('This password is too common');
    expect(passwordProblems('a'.repeat(80) + '1')).toContain('Use at most 72 bytes');
    expect(passwordProblems('correct-horse-9')).toEqual([]);
  });
  it('verifies', async () => {
    const h = await hashPassword('correct-horse-9');
    expect(await verifyPassword('correct-horse-9', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
    expect(await verifyPassword('timing-equaliser', null)).toBe(false);
  });
});

describe('cipher', () => {
  it('is bound to its context', () => {
    const c = new FieldCipher(randomBytes(32).toString('base64'));
    const v = c.encrypt('ABCDE1234F', 'tenant-a');
    expect(c.decrypt(v, 'tenant-a')).toBe('ABCDE1234F');
    expect(() => c.decrypt(v, 'tenant-b')).toThrow();
  });
  it('rejects short keys', () => expect(() => new FieldCipher('abcd')).toThrow());
});
