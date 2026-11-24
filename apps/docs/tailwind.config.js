/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { bg: 'var(--bg)', surface: 'var(--surface)', ink: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)', brand: 'var(--brand)', 'brand-ink': 'var(--brand-ink)', 'brand-soft': 'var(--brand-soft)', danger: 'var(--danger)' }
    }
  }
};
