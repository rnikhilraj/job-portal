import nextJest from 'next/jest.js';

// next/jest wires up SWC transforms, tsconfig path aliases and env loading.
const createJestConfig = nextJest({ dir: './' });

/**
 * Two projects, because the suites need different environments: API and domain
 * tests run against Node with a real in-memory MongoDB, while component tests
 * need a DOM.
 *
 * `collectCoverageFrom` deliberately includes src/components. It previously did
 * not, which meant the headline coverage figure was computed over a narrowing
 * slice of the codebase and said nothing at all about the UI layer.
 */
const shared = {
  clearMocks: true,
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
};

const config = {
  // A shared in-memory MongoDB instance per file means suites must not overlap.
  maxWorkers: 1,
  testTimeout: 30_000,
  collectCoverageFrom: [
    'src/app/api/**/*.ts',
    'src/modules/**/*.ts',
    'src/lib/**/*.ts',
    'src/components/**/*.tsx',
    '!src/lib/http.ts',
  ],
  /*
   * Ratchets, set just under the current numbers so they catch a regression
   * without tripping on noise. They are deliberately per-layer: the server side
   * is where a slip is dangerous and is held near 90, while the component floor
   * is honestly low and is meant to be raised as suites are added rather than
   * to pretend the UI is well covered today.
   *
   * `src/lib/seed.ts` sits at 0% here on purpose — it runs only at boot, and
   * the docker job in CI asserts "[seed] complete" instead, which is the
   * meaningful check for it.
   */
  coverageThreshold: {
    // Directory keys group the files beneath them; a glob key would instead
    // apply the numbers to every file individually and pull those files out of
    // the global pool, which is not what is wanted here.
    './src/modules/': { statements: 88, branches: 74, functions: 86, lines: 88 },
    './src/lib/api/': { statements: 94, branches: 84, functions: 100, lines: 94 },
    // Note this pool excludes the directory-keyed groups above, so it is not
    // the same number the summary row prints — it covers components plus the
    // non-api lib files.
    global: { statements: 52, branches: 28, functions: 45, lines: 51 },
  },
  projects: [
    {
      ...shared,
      displayName: 'api',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
    },
    {
      ...shared,
      displayName: 'components',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.components.ts'],
      testMatch: ['<rootDir>/tests/components/**/*.test.tsx'],
    },
  ],
};

/**
 * next/jest returns an async factory, so each project is created through it
 * individually and the results are stitched back together.
 */
export default async function jestConfig() {
  const projects = await Promise.all(
    config.projects.map(async (project) => {
      const resolved = await createJestConfig(project)();
      // next/jest injects its own ignore patterns; keep ours alongside them.
      return { ...resolved, displayName: project.displayName };
    }),
  );

  return { ...config, projects };
}
