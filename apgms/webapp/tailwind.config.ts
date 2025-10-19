import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff'
        },
        background: '#f8fafc',
        foreground: '#0f172a',
        muted: '#e2e8f0',
        'muted-foreground': '#475569',
        border: '#cbd5f5'
      }
    }
  },
  plugins: []
} satisfies Config;
