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
    passwordHash: await hashPassword(password),
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
