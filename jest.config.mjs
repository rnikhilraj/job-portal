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
   * without tripping on noise. They are deliberately per-layer, because the
   * layers carry different risk and a single global figure hides both.
   *
   * `src/components/` now has its own key. It used to sit in the global pool at
   * around 50%, which was honest but thin; the suites behind these numbers were
   * what turned up the profile form dropping a cleared experience level and the
   * logout button swallowing a failed request, so the floor is worth holding.
   *
   * Directory keys group the files beneath them; a glob key would instead apply
   * the numbers to every file individually and pull those files out of the
   * global pool, which is not what is wanted here. What global covers, after the
   * three keyed groups are removed, is `src/app/api/` plus the non-api files in
   * `src/lib/` — so it is not the number the summary row prints.
   *
   * `src/lib/seed.ts` sits at 0% here on purpose — it runs only at boot, and
   * the docker job in CI asserts "[seed] complete" instead, which is the
   * meaningful check for it. It is the single reason the global branch floor
   * is far below the others.
   */
  coverageThreshold: {
    './src/modules/': { statements: 93, branches: 87, functions: 96, lines: 95 },
    './src/lib/api/': { statements: 96, branches: 86, functions: 100, lines: 96 },
    './src/components/': { statements: 97, branches: 92, functions: 96, lines: 98 },
    global: { statements: 86, branches: 63, functions: 86, lines: 86 },
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
