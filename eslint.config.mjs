import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint 9 flat config.
 *
 * eslint-config-next 16 exports flat config natively, so these are spread
 * directly — no FlatCompat bridge and no @eslint/eslintrc shim, both of which
 * the eslintrc-era config needed.
 */
const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'coverage/**', 'next-env.d.ts', 'uploads/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default config;
