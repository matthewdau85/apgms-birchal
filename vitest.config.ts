import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    watch: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'json', 'lcov'],
      lines: 80,
      statements: 80,
      functions: 80,
      branches: 75
    }
  }
});
