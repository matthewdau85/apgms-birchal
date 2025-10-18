import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f4f6ff',
          100: '#e5ebff',
          200: '#ccd6ff',
          300: '#a5b6ff',
          400: '#7b8fff',
          500: '#4d63ff',
          600: '#3847db',
          700: '#2d37b3',
          800: '#252f8f',
          900: '#202874',
        },
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(15, 23, 42, 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config;
