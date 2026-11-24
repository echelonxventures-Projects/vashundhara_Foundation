import { expect, it } from 'vitest';
import { formatMinor, rupeesInWords, toMinor } from './money';
it('parses without float error', () => {
  expect(toMinor('1,234.5')).toBe(123450);
  expect(toMinor('0.07')).toBe(7);
  expect(toMinor('1.005')).toBeNull();
  expect(toMinor('-5')).toBeNull();
  expect(toMinor('12', 'JPY')).toBe(12);
});
it('formats in lakhs', () => expect(formatMinor(12345600)).toBe('₹1,23,456'));
it('spells amounts', () => {
  expect(rupeesInWords(12345678)).toBe('Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only');
  expect(rupeesInWords(1000000000)).toBe('Rupees One Crore Only');
  expect(rupeesInWords(50)).toBe('Rupees Zero and Fifty Paise Only');
});
