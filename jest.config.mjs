import nextJest from 'next/jest.js';

// next/jest wires up SWC transforms, tsconfig path aliases and env loading.
const createJestConfig = nextJest({ dir: './' });

/**
 * Three projects, because the suites need different environments: API and
 * domain tests run against Node with a real in-memory MongoDB, component tests
 * need a DOM, and `unit` covers everything that needs neither.
 *
 * That third project is not cosmetic. Every file in the `api` project boots its
 * own MongoMemoryServer via jest.setup.ts, and six suites were paying for one
 * they never queried. Under load that boot can exceed mongodb-memory-server's
 * 10s limit and fail a suite that does nothing but read files off disk — which
 * is exactly how the import-graph guard once went red. Suites that need no
 * database now say so by living in tests/unit/.
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
  /*
   * 60s, not 30s, because some API tests are slow by design rather than by
   * accident. bcrypt runs at cost 12 and login answers a miss with an
   * equivalent comparison against a dummy hash, so the rate-limit test spends
   * ~250ms per attempt on this machine purely to exhaust the limit — eleven
   * real bcrypt operations is the thing it is testing.
   *
   * Reducing the cost factor under NODE_ENV=test would be the other way to buy
   * the headroom, and is deliberately not done: it would put a branch in a
   * security-critical file and mean the suite no longer exercises the hashing
   * the README describes. Waiting is cheaper than that trade.
   */
  testTimeout: 60_000,
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
      // tests/unit is excluded: those suites need no database, and the `unit`
      // project below runs them without starting one.
      testMatch: ['<rootDir>/tests/**/*.test.ts'],
      testPathIgnorePatterns: ['<rootDir>/tests/unit/'],
    },
    {
      ...shared,
      displayName: 'unit',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.unit.ts'],
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
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
