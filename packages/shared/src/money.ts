export const CURRENCIES = {
  USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
  INR: { symbol: '₹', decimals: 2, name: 'Indian Rupee' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  GBP: { symbol: '£', decimals: 2, name: 'British Pound' },
  JPY: { symbol: '¥', decimals: 0, name: 'Japanese Yen' },
  CAD: { symbol: 'C$', decimals: 2, name: 'Canadian Dollar' },
  AUD: { symbol: 'A$', decimals: 2, name: 'Australian Dollar' },
  SGD: { symbol: 'S$', decimals: 2, name: 'Singapore Dollar' },
  AED: { symbol: 'د.إ', decimals: 2, name: 'UAE Dirham' },
  SAR: { symbol: '﷼', decimals: 2, name: 'Saudi Riyal' }
} as const;
export type CurrencyCode = keyof typeof CURRENCIES;

/** Parses "1,234.50" into minor units without floating point. Returns null when invalid. */
export function toMinor(text: string, currency: CurrencyCode = 'INR'): number | null {
  const d = CURRENCIES[currency].decimals;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.replace(/[,\s]/g, ''));
  if (!m || (m[2]?.length ?? 0) > d) return null;
  const n = Number(m[1] + (m[2] ?? '').padEnd(d, '0'));
  return Number.isSafeInteger(n) ? n : null;
}

export function formatMinor(minor: number | bigint, currency: CurrencyCode = 'INR', locale = 'en'): string {
  const d = CURRENCIES[currency].decimals;
  const v = Number(minor) / 10 ** d;
  const tag = currency === 'INR' && locale === 'en' ? 'en-IN' : locale;
  return new Intl.NumberFormat(tag, { style: 'currency', currency, minimumFractionDigits: Number.isInteger(v) ? 0 : d, maximumFractionDigits: d }).format(v);
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number): string => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
function words(n: number): string {
  if (n >= 1e7) return `${words(Math.floor(n / 1e7))} Crore${n % 1e7 ? ` ${words(n % 1e7)}` : ''}`;
  if (n >= 1e5) return `${below100(Math.floor(n / 1e5))} Lakh${n % 1e5 ? ` ${words(n % 1e5)}` : ''}`;
  if (n >= 1000) return `${below100(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${words(n % 1000)}` : ''}`;
  if (n >= 100) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${below100(n % 100)}` : ''}`;
  return below100(n);
}
/** Amount in words, Indian numbering, for receipts. */
export function rupeesInWords(paise: number): string {
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  return `Rupees ${r ? words(r) : 'Zero'}${p ? ` and ${below100(p)} Paise` : ''} Only`;
}
