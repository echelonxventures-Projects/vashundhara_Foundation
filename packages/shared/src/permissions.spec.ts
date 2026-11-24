import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, ROLE_TEMPLATES, hasPermission } from './permissions';
import { fiscalYear, fiscalYearRange } from './fiscal';

describe('permissions', () => {
  it('role templates only use known permissions', () => {
    for (const r of ROLE_TEMPLATES) for (const p of r.permissions) expect(ALL_PERMISSIONS).toContain(p);
  });
  it('manage implies other actions, but not other resources', () => {
    expect(hasPermission(['hours:manage'], 'hours:read')).toBe(true);
    expect(hasPermission(['hours:manage'], 'donors:read')).toBe(false);
    expect(hasPermission([], 'donors:read')).toBe(false);
  });
  it('no tenant role can administer the platform', () => {
    for (const r of ROLE_TEMPLATES.filter((x) => x.scope === 'TENANT'))
      expect(r.permissions.filter((p) => p.startsWith('platform:') || p === 'tenants:manage')).toEqual([]);
  });
  it('auditor cannot change anything', () => {
    const a = ROLE_TEMPLATES.find((r) => r.name === 'auditor')!;
    expect(a.permissions.every((p) => /:(read|export)$/.test(p))).toBe(true);
  });
});

describe('fiscal year', () => {
  it('rolls over at midnight IST on 1 April', () => {
    expect(fiscalYear(new Date('2026-03-31T18:29:59Z'))).toBe('2025-26');
    expect(fiscalYear(new Date('2026-03-31T18:30:00Z'))).toBe('2026-27');
    expect(fiscalYear(new Date('2099-06-01T00:00:00Z'))).toBe('2099-00');
  });
  it('range matches', () => {
    expect(fiscalYearRange('2026-27').start.toISOString()).toBe('2026-03-31T18:30:00.000Z');
    expect(() => fiscalYearRange('2026-28')).toThrow();
  });
});
