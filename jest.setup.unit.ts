import { resetEnvCache } from '@/lib/env';
import { resetRateLimits } from '@/lib/rate-limit';

/**
 * Setup for the `unit` project: suites that touch neither the database nor the
 * DOM. Deliberately does NOT start a MongoMemoryServer.
 *
 * That omission is the point. `jest.setup.ts` boots one per test file, and six
 * suites were paying for a mongod they never queried — static import-graph
 * walks, the copy guard, pure helper functions and the error envelope. On a
 * loaded machine that boot can exceed mongodb-memory-server's own 10s limit,
 * and a suite that only reads files off disk would fail with "Instance failed
 * to start". Separating them removes six boots from every run and makes these
 * suites incapable of failing for a reason unrelated to what they assert.
 *
 * The environment variables are still set: nothing here is expected to call
 * getEnv(), but a helper that grows a dependency on it should not fail
 * mysteriously in this project alone.
 */
beforeAll(() => {
  process.env.JWT_SECRET = 'test_secret_value_that_is_long_enough_1234567890';
  process.env.JWT_EXPIRES_IN_SECONDS = '3600';
  process.env.MONGODB_URI = 'mongodb://unused.invalid:27017/never_connected';
  resetEnvCache();
});

afterEach(() => {
  resetRateLimits();
});
