import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          foreground: '#f8fafc',
        },
      },
      boxShadow: {
        subtle: '0 10px 30px -15px rgba(15, 23, 42, 0.4)',
      },
    },
  },
  plugins: [],
};

export default config;
