import { expect, it } from 'vitest';
import { printable, TextPdf } from './pdf-text';

const NAMES: Record<string, string> = {
  NotoSansDevanagari: 'श्री कृष्ण द्विवेदी क्षमा र्‍हास', NotoSansBengali: 'বন্দ্যোপাধ্যায় ৱাহিদ', NotoSansTamil: 'சுப்பிரமணியன்', NotoSansTelugu: 'శ్రీ రాష్ట్రం', NotoSansGujarati: 'ત્રિવેદી',
  NotoSansKannada: 'ಲಕ್ಷ್ಮಿ ಜ್ಞಾನ', NotoSansMalayalam: 'കൃഷ്ണൻ ട്രസ്റ്റ്', NotoSansOriya: 'ମହାପାତ୍ର', NotoSansGurmukhi: 'ਗੁਰਪ੍ਰੀਤ ਸਿੰਘ', NotoNaskhArabic: 'محمد عبداللہ', NotoSans: 'José Ştefan ₹1,00,000'
};
const pdf = () => TextPdf.create({ size: 'A4', margin: 40 });

it('prints every script, plain and bold, with its own font and the real text for copying', async () => {
  const p = await pdf();
  for (const n of Object.values(NAMES)) p.text(n, { size: 12 }).text(n, { size: 12, bold: true });
  const raw = (await p.buffer()).toString('latin1');
  for (const f of Object.keys(NAMES)) for (const w of ['Regular', 'Bold']) expect(raw, f).toContain(`+${f}-${w}`);
});
it('keeps each name in one run, and mixed text in page order', async () => {
  const p = await pdf();
  for (const [f, n] of Object.entries(NAMES)) expect([...new Set(p.fonts(n).filter((x) => x.c !== ' ').map((x) => x.font))], f).toEqual([f]);
  expect(p.runs('Asha आशा।').map((r) => r.font)).toEqual(['NotoSans', 'NotoSansDevanagari']);
  // Right to left: the first word is drawn last, and the Latin part keeps its own direction.
  const r = p.runs('محمد (Delhi) ٹرسٹ');
  expect(r[0].text.trim()).toBe('ٹرسٹ');
  expect(r[r.length - 1].text.trim()).toBe('محمد');
  expect(r.some((x) => x.text.includes('Delhi') && x.level % 2 === 0)).toBe(true);
});
it('wraps within the width and only between whole letters', async () => {
  const p = await pdf();
  const long = 'क्षत्रिय'.repeat(30);
  const lines = p.lines(long, 150, 11);
  expect(lines.length).toBeGreaterThan(2);
  expect(lines.join('')).toBe(long);
  for (const l of lines) expect(l).not.toMatch(/^\p{M}/u);
  expect(p.lines('one two three', 1000, 10)).toEqual(['one two three']);
});
it('a long text continues on a new page', async () => {
  const p = await pdf();
  p.text('शब्द '.repeat(3000), { size: 12 });
  const raw = (await p.buffer()).toString('latin1');
  expect(raw.match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
});
it('removes what must not be printed', () => {
  expect(printable('A‮gnp.exe\u0000\n😀B')).toBe('Agnp.exe B');
  expect(printable(' ‎ ')).toBe('-');
  expect(printable('र्‍या')).toContain('‍');
  expect(printable('Flat #12*')).toBe('Flat #12*');
});
it('a character no font covers becomes a question mark and never fails', async () => {
  const p = await pdf();
  expect(p.fonts('漢').map((x) => x.c)).toEqual(['?']);
  for (const odd of ['́', '‍', '\ud800', 'ा', '𑀅', '।']) p.text(odd, { size: 10 });
  expect((await p.buffer()).length).toBeGreaterThan(500);
});
