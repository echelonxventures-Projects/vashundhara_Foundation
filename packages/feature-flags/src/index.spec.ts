import { expect, it } from 'vitest';
import { bucket, evaluate } from './index';
const f = { key: 'x', type: 'BOOLEAN' as const, defaultValue: true, isEnabled: true, rolloutPercentage: 100 };
it('evaluates', () => {
  expect(evaluate(f, 'u').on).toBe(true);
  expect(evaluate({ ...f, isEnabled: false }, 'u').value).toBe(false);
  expect(evaluate({ ...f, rolloutPercentage: 0 }, 'u').on).toBe(false);
  expect(bucket('x', 'u')).toBe(bucket('x', 'u'));
});
