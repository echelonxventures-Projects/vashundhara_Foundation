import { expect, it } from 'vitest';
import { csvCell, parseCsv, toCsv } from './csv';
it('neutralises formulas and quotes', () => {
  expect(csvCell('=1+1')).toBe("'=1+1");
  expect(csvCell('-5.5')).toBe('-5.5');
  expect(csvCell('a"b,c')).toBe('"a""b,c"');
});
it('round trips', () => {
  expect(parseCsv('\uFEFF' + toCsv(['a', 'b'], [{ a: 'x,\n"y"', b: 2 }]))).toEqual([{ a: 'x,\n"y"', b: '2' }]);
});
