import nextJest from 'next/jest.js';

// next/jest wires up SWC transforms, tsconfig path aliases and env loading.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  // Keep Jest out of the standalone build output copied by `next build`.
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  // A shared in-memory MongoDB instance per file means suites must not overlap.
  maxWorkers: 1,
  testTimeout: 30_000,
  clearMocks: true,
  collectCoverageFrom: [
    'src/app/api/**/*.ts',
    'src/modules/**/*.ts',
    'src/lib/**/*.ts',
    '!src/lib/http.ts',
  ],
};

export default createJestConfig(config);
