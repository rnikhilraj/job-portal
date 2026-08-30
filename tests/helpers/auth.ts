import { signSessionToken } from '@/modules/auth/jwt';
import { hashPassword } from '@/modules/auth/password';
import { SESSION_COOKIE_NAME } from '@/modules/auth/session';
import { User, type UserDocument, type UserRole } from '@/modules/users/user.model';

export type TestUser = {
  user: UserDocument;
  id: string;
  email: string;
  password: string;
  /** Ready-to-use `Cookie` header value carrying a genuinely signed JWT. */
  cookie: string;
};

let sequence = 0;

/**
 * bcrypt hashes, memoised per distinct password.
 *
 * Fixtures are the dominant cost in the API suites: they are created ~190 times
 * across the run and almost all of them use the same default password, so
 * without this the suite pays for the same cost-12 hash again and again. The
 * one that timed out under a full run was doing nothing but creating two users.
 *
 * The value produced is a genuine bcrypt hash of that password — it is only
 * computed once instead of once per fixture — so a test that signs in with the
 * password still exercises the real comparison. What is lost is a distinct salt
 * per fixture, which nothing asserts on and which carries no meaning here.
 * Production hashing is untouched: `hashPassword` is called normally, and the
 * signup path that tests assert against does not come through this helper.
 */
const hashCache = new Map<string, Promise<string>>();

function cachedHash(password: string): Promise<string> {
  let hash = hashCache.get(password);
  if (!hash) {
    hash = hashPassword(password);
    hashCache.set(password, hash);
  }
  return hash;
}

/**
 * Creates a persisted user and a real signed session cookie, so tests go
 * through the same verification path as production traffic.
 */
export async function createTestUser(
  role: UserRole,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestUser> {
  sequence += 1;

  const email = overrides.email ?? `${role.toLowerCase()}${sequence}@example.com`;
  const password = overrides.password ?? 'Passw0rd123';

  const user = await User.create({
    email,
    name: overrides.name ?? `${role} User ${sequence}`,
    role,
    passwordHash: await cachedHash(password),
    skills: [],
  });

  const token = await signSessionToken({
    userId: String(user._id),
    email: user.email,
    role: user.role,
  });

  return {
    user,
    id: String(user._id),
    email,
    password,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  };
}

export const createHr = (overrides?: Parameters<typeof createTestUser>[1]) =>
  createTestUser('HR', overrides);

export const createCandidate = (overrides?: Parameters<typeof createTestUser>[1]) =>
  createTestUser('CANDIDATE', overrides);

/** Builds a cookie for a user id that no longer exists in the database. */
export async function cookieForDeletedUser(): Promise<string> {
  const token = await signSessionToken({
    userId: '000000000000000000000000',
    email: 'ghost@example.com',
    role: 'CANDIDATE',
  });
  return `${SESSION_COOKIE_NAME}=${token}`;
}
