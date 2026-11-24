import { expect, it } from 'vitest';
import { applyTemplate, changedFields, checkDefinition, coerceValue, CustomField, Definition, emptyDefinition, EXTENDABLE, keepRemoved, keyFrom, KEY, RECORD_BY_PATH, RECORDS, ruleMatches } from './index';

const f = (x: Partial<CustomField>): CustomField => ({ key: 'x_1', label: 'X', type: 'text', ...x });
const val = (x: Partial<CustomField>, raw: unknown) => { const r = coerceValue(f(x), raw); return 'error' in r ? 'ERR' : r.value; };
const def = (x: Partial<Definition>): Definition => ({ ...emptyDefinition(), ...x });

it('turns input into stored values and refuses bad ones', () => {
  expect(val({ type: 'number' }, '1,200')).toBe(1200);
  expect(val({ type: 'number', max: 5 }, 6)).toBe('ERR');
  expect(val({ type: 'money' }, 10.5)).toBe('ERR');
  expect(val({ type: 'date' }, '2026-02-30')).toBe('ERR');
  expect(val({ type: 'date' }, '2026-02-28T00:00:00+05:30')).toBe('2026-02-28');
  expect(val({ type: 'url' }, 'javascript:alert(1)')).toBe('ERR');
  expect(val({ type: 'email' }, 'A@B.org')).toBe('a@b.org');
  expect(val({ type: 'text' }, { a: 1 })).toBe('ERR');
  expect(val({ type: 'bool' }, undefined)).toBe(false);
  expect(val({ type: 'text' }, '')).toBe(null);
  const choices = [{ value: 'a', label: 'Apple' }, { value: 'b', label: 'Bee', archived: true }];
  expect(val({ type: 'select', choices }, 'apple')).toBe('a');
  expect(val({ type: 'select', choices }, 'b')).toBe('ERR');
  expect(coerceValue(f({ type: 'select', choices }), 'b', 'b')).toEqual({ value: 'b' });
  expect(val({ type: 'multi', choices }, ['a', 'a'])).toEqual(['a']);
});
it('locks records, consent and money', () => {
  expect(checkDefinition(def({ entities: { receipts: { fields: [] } } }))).toHaveLength(1);
  expect(checkDefinition(def({ entities: { donations: { fields: [f({})], layout: { hidden: ['status'] } } } }))).toHaveLength(1);
  expect(checkDefinition(def({ entities: { beneficiaries: { fields: [], layout: { hidden: ['consentAt', 'fullName'] } } } }))).toHaveLength(2);
  expect(checkDefinition(def({ entities: { beneficiaries: { fields: [], layout: { hidden: ['notes'], labels: { need: 'Support needed' } } } } }))).toEqual([]);
  expect(checkDefinition(def({ entities: { deals: { fields: [], layout: { choices: { status: ['x'] } } } } }))).toHaveLength(1);
  for (const e of EXTENDABLE) expect(e === 'donations' || e in RECORDS, e).toBe(true);
  expect(RECORD_BY_PATH['crm/contacts']).toBe('contacts');
  expect(RECORD_BY_PATH.receipts).toBeUndefined();
});
it('finds broken links, forms and rules', () => {
  const t = { key: 'trips', title: 'Trips', fields: [f({ key: 'town', label: 'Town', required: true }), f({ key: 'doc', label: 'Doc', type: 'file' })] };
  const p = checkDefinition(def({ tables: [t, { key: 'bad', title: 'Bad', fields: [f({ type: 'ref', ref: 'x:none' })] }], forms: [{ key: 'ask', title: 'Ask', table: 'trips', access: 'PUBLIC', active: true, fields: [{ key: 'doc' }] }], rules: [{ key: 'r1', name: 'R', entity: 'x:trips', on: 'CREATED', active: true, conditions: [{ field: 'nope', op: 'eq' }], actions: [] }] }));
  expect(p.map((x) => x.message).join('|')).toMatch(/links to.*cannot be on a form.*must be on the form.*does not exist.*at least one action/);
});
it('archives what is removed instead of losing it', () => {
  const before = def({ entities: { donors: { fields: [f({ key: 'k1', type: 'select', choices: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }), f({ key: 'k2' })] } }, tables: [{ key: 't1', title: 'T', fields: [f({})] }] });
  const after = keepRemoved(before, def({ entities: { donors: { fields: [f({ key: 'k1', type: 'select', choices: [{ value: 'a', label: 'A' }] })] } } }));
  expect(after.entities.donors.fields.find((x) => x.key === 'k2')?.archived).toBe(true);
  expect(after.entities.donors.fields[0].choices?.[1]).toMatchObject({ value: 'b', archived: true });
  expect(after.tables[0].archived).toBe(true);
  expect(changedFields(before, after).map((x) => x.key)).toEqual(['k1', 'k2']);
});
it('templates add and never overwrite; rules match', () => {
  const r = applyTemplate(def({ entities: { donors: { fields: [f({ label: 'Mine' })] } } }), def({ entities: { donors: { fields: [f({ label: 'Theirs' }), f({ key: 'x_2' })] } } }));
  expect(r.definition.entities.donors.fields.map((x) => x.label)).toEqual(['Mine', 'X']);
  expect(r.skipped).toHaveLength(1);
  const rule = { key: 'r1', name: '', entity: 'x:t', on: 'SAVED' as const, active: true, conditions: [{ field: 'n', op: 'gt' as const, value: '9' }, { field: 'n', op: 'changed' as const }], actions: [] };
  expect(ruleMatches(rule, { n: 10 }, ['n'])).toBe(true);
  expect(ruleMatches(rule, { n: 10 }, [])).toBe(false);
  for (const l of ['Blood group', 'रक्त समूह', '9 lives', 'A']) expect(keyFrom(l), l).toMatch(KEY);
});
