const ignoredGlobs = [
  '**/node_modules/**',
  '**/dist/**',
  '**/coverage/**',
  'pnpm-lock.yaml',
  '**/pnpm-lock.yaml',
  'services/**',
  'shared/**',
  'worker/**',
  'webapp/**',
  'docs/**',
  'scripts/seed.ts',
  'types/**',
  '**/*.ts',
  '**/*.tsx',
];

export default [
  {
    ignores: ignoredGlobs,
  },
];
