import { readFileSync } from 'fs';
import { join } from 'path';
import { expect, it } from 'vitest';
import { LOCALES, Messages, withFallback } from './i18n';

const load = (l: string) => JSON.parse(readFileSync(join(__dirname, `../locales/${l}.json`), 'utf8')) as Messages;
const flat = (m: Messages, p = ''): Record<string, string> => Object.entries(m).reduce((a, [k, v]) => ({ ...a, ...(typeof v === 'string' ? { [p + k]: v } : flat(v, `${p}${k}.`)) }), {});
const args = (s: string) => [...s.matchAll(/\{(\w+)/g)].map((x) => x[1]).filter((x) => x !== 'one').sort().filter((x, i, a) => a.indexOf(x) === i);
const en = flat(load('en'));

it('Hindi is complete', () => expect(Object.keys(flat(load('hi'))).sort()).toEqual(Object.keys(en).sort()));
it('no language has unknown keys, wrong placeholders, or untranslated copies', () => {
  for (const l of LOCALES.filter((x) => x !== 'en')) for (const [k, v] of Object.entries(flat(load(l)))) {
    expect(en[k], `${l} ${k}`).toBeDefined();
    if (!/plural/.test(v)) expect(args(v), `${l} ${k}`).toEqual(args(en[k]));
    expect(v, `${l} ${k}`).not.toBe(en[k]);
  }
});
it('falls back to English', () => expect(withFallback({ a: { b: 'x', c: 'y' } }, { a: { b: 'z' } })).toEqual({ a: { b: 'z', c: 'y' } }));
