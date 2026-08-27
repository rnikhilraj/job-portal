import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

import { ForbiddenError, UnauthorizedError } from '@/lib/api/errors';
import { connectToDatabase } from '@/lib/db';
import { getEnv, isProduction } from '@/lib/env';
import { signSessionToken, verifySessionToken, type SessionPayload } from '@/modules/auth/jwt';
import { User, type UserDocument, type UserRole } from '@/modules/users/user.model';

export const SESSION_COOKIE_NAME = 'session';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
    path: '/',
    maxAge: getEnv().JWT_EXPIRES_IN_SECONDS,
  };
}

/** Issues the session cookie on an outgoing response. */
export async function attachSessionCookie(
  response: NextResponse,
  payload: SessionPayload,
): Promise<NextResponse> {
  response.cookies.set(SESSION_COOKIE_NAME, await signSessionToken(payload), cookieOptions());
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, '', { ...cookieOptions(), maxAge: 0 });
  return response;
}

/**
 * Reads and verifies the session from an API request. Returns null rather than
 * throwing so callers can distinguish "optional auth" from "required auth".
 */
export async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Same as getSession, for server components where there is no NextRequest. */
export async function getServerSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Resolves the signed-in user from the database.
 *
 * The role is re-read from Mongo rather than trusted from the token, so an
 * account that was deleted or had its role changed cannot keep acting on a
 * still-valid JWT.
 */
export async function requireUser(request: NextRequest): Promise<UserDocument> {
  const session = await getSession(request);
  if (!session) throw new UnauthorizedError();

  await connectToDatabase();
  const user = await User.findById(session.userId);
  if (!user) throw new UnauthorizedError('Your session is no longer valid.');

  return user;
}

/**
 * Authorization gate used by every role-restricted route. Callers that are not
 * signed in get 401; callers with the wrong role get 403.
 */
export async function requireRole(request: NextRequest, role: UserRole): Promise<UserDocument> {
  const user = await requireUser(request);
  if (user.role !== role) {
    throw new ForbiddenError(`This action is restricted to ${role} accounts.`);
  }
  return user;
}

/** Convenience wrapper used by server components that render for one role. */
export async function getCurrentUser(): Promise<UserDocument | null> {
  const session = await getServerSession();
  if (!session) return null;

  await connectToDatabase();
  return User.findById(session.userId);
}
