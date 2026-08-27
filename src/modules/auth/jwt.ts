import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

import { getEnv } from '@/lib/env';
import { USER_ROLES, type UserRole } from '@/modules/users/user.constants';

const JWT_ALGORITHM = 'HS256';
const JWT_ISSUER = 'job-application-tracker';

export type SessionPayload = {
  userId: string;
  email: string;
  role: UserRole;
};

const payloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
});

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const { JWT_EXPIRES_IN_SECONDS } = getEnv();
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(payload.userId)
    .setIssuer(JWT_ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + JWT_EXPIRES_IN_SECONDS)
    .sign(secretKey());
}

/** Returns null for any token that is missing, malformed, expired or re-signed. */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
    });

    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return null;

    return { userId: parsed.data.sub, email: parsed.data.email, role: parsed.data.role };
  } catch {
    return null;
  }
}
