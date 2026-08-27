import { ConflictError, UnauthorizedError } from '@/lib/api/errors';
import type { SessionPayload } from '@/modules/auth/jwt';
import {
  hashPassword,
  simulatePasswordVerification,
  verifyPassword,
} from '@/modules/auth/password';
import type { LoginInput, SignupInput } from '@/modules/auth/auth.schema';
import { User, toPublicUser, type PublicUser } from '@/modules/users/user.model';

export type AuthResult = { user: PublicUser; session: SessionPayload };

/**
 * Registers a candidate. The role is hardcoded here rather than taken from
 * input — HR accounts exist only via the seed, so there is no public path to an
 * elevated role.
 */
export async function registerCandidate(input: SignupInput): Promise<AuthResult> {
  const existing = await User.exists({ email: input.email });
  if (existing) {
    throw new ConflictError('An account with that email already exists.');
  }

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: 'CANDIDATE',
    skills: [],
  });

  return {
    user: toPublicUser(user),
    session: { userId: String(user._id), email: user.email, role: user.role },
  };
}

/**
 * Verifies credentials. Both "no such account" and "wrong password" produce the
 * identical error and comparable timing, so the endpoint cannot be used to
 * enumerate registered email addresses.
 */
export async function authenticate(input: LoginInput): Promise<AuthResult> {
  const invalidCredentials = new UnauthorizedError('Invalid email or password.');

  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  if (!user) {
    await simulatePasswordVerification(input.password);
    throw invalidCredentials;
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw invalidCredentials;
  }

  return {
    user: toPublicUser(user),
    session: { userId: String(user._id), email: user.email, role: user.role },
  };
}
