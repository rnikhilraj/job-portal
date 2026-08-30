import { SignJWT } from 'jose';

import { POST as login } from '@/app/api/auth/login/route';
import { GET as me } from '@/app/api/auth/me/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { POST as signup } from '@/app/api/auth/signup/route';
import { resetRateLimits } from '@/lib/rate-limit';
import { SESSION_COOKIE_NAME } from '@/modules/auth/session';
import { verifySessionToken } from '@/modules/auth/jwt';
import { User, type PublicUser } from '@/modules/users/user.model';

import { cookieForDeletedUser, createCandidate } from './helpers/auth';
import { jsonRequest, readJson, routeContext, type ApiData, type ApiError } from './helpers/request';

const emptyContext = routeContext({});

const validSignup = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'Analyt1calEngine',
};

function sessionCookieFrom(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) throw new Error('Expected a Set-Cookie header');
  const value = setCookie.split(';')[0];
  if (!value) throw new Error('Malformed Set-Cookie header');
  return value;
}

beforeEach(() => {
  resetRateLimits();
});

describe('POST /api/auth/signup', () => {
  it('creates a candidate and issues an httpOnly session cookie', async () => {
    const response = await signup(
      jsonRequest('/api/auth/signup', { method: 'POST', body: validSignup }),
      emptyContext,
    );

    expect(response.status).toBe(201);

    const body = await readJson<ApiData<PublicUser>>(response);
    expect(body.data).toMatchObject({ email: 'ada@example.com', role: 'CANDIDATE' });
    expect(body.data).not.toHaveProperty('passwordHash');

    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
  });

  it('stores a bcrypt hash rather than the plaintext password', async () => {
    await signup(
      jsonRequest('/api/auth/signup', { method: 'POST', body: validSignup }),
      emptyContext,
    );

    const stored = await User.findOne({ email: validSignup.email }).select('+passwordHash');
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored?.passwordHash).not.toContain(validSignup.password);
  });

  it('rejects a duplicate email with 409', async () => {
    await signup(
      jsonRequest('/api/auth/signup', { method: 'POST', body: validSignup }),
      emptyContext,
    );

    const response = await signup(
      jsonRequest('/api/auth/signup', {
        method: 'POST',
        body: { ...validSignup, name: 'Someone Else' },
      }),
      emptyContext,
    );

    expect(response.status).toBe(409);
    const body = await readJson<ApiError>(response);
    expect(body.error.code).toBe('CONFLICT');
    expect(await User.countDocuments({ email: validSignup.email })).toBe(1);
  });

  it('treats email as case-insensitive when detecting duplicates', async () => {
    await signup(
      jsonRequest('/api/auth/signup', { method: 'POST', body: validSignup }),
      emptyContext,
    );

    const response = await signup(
      jsonRequest('/api/auth/signup', {
        method: 'POST',
        body: { ...validSignup, email: 'ADA@Example.com' },
      }),
      emptyContext,
    );

    expect(response.status).toBe(409);
  });

  it('ignores a role supplied by the client and always creates a candidate', async () => {
    const response = await signup(
      jsonRequest('/api/auth/signup', {
        method: 'POST',
        body: { ...validSignup, role: 'HR' },
      }),
      emptyContext,
    );

    expect(response.status).toBe(201);
    const body = await readJson<ApiData<PublicUser>>(response);
    expect(body.data.role).toBe('CANDIDATE');

    const token = sessionCookieFrom(response).split('=').slice(1).join('=');
    expect((await verifySessionToken(token))?.role).toBe('CANDIDATE');
  });

  it('returns 400 with per-field details for a weak password and bad email', async () => {
    const response = await signup(
      jsonRequest('/api/auth/signup', {
        method: 'POST',
        body: { name: 'A', email: 'not-an-email', password: 'short' },
      }),
      emptyContext,
    );

    expect(response.status).toBe(400);
    const body = await readJson<ApiError>(response);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(body.error.details as Record<string, string[]>)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });

  it('rate limits repeated signup attempts from one client', async () => {
    const attempt = (index: number) =>
      signup(
        jsonRequest('/api/auth/signup', {
          method: 'POST',
          body: { ...validSignup, email: `flood${index}@example.com` },
          headers: { 'x-forwarded-for': '203.0.113.9' },
        }),
        emptyContext,
      );

    for (let index = 0; index < 10; index += 1) {
      expect((await attempt(index)).status).toBe(201);
    }

    expect((await attempt(99)).status).toBe(429);
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with correct credentials', async () => {
    const candidate = await createCandidate({ email: 'sam@example.com' });

    const response = await login(
      jsonRequest('/api/auth/login', {
        method: 'POST',
        body: { email: candidate.email, password: candidate.password },
      }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect((await readJson<ApiData<PublicUser>>(response)).data.email).toBe(candidate.email);
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE_NAME}=`);
  });

  it('rejects a wrong password with 401 and sets no cookie', async () => {
    const candidate = await createCandidate({ email: 'sam@example.com' });

    const response = await login(
      jsonRequest('/api/auth/login', {
        method: 'POST',
        body: { email: candidate.email, password: 'Wr0ngPassword' },
      }),
      emptyContext,
    );

    expect(response.status).toBe(401);
    expect((await readJson<ApiError>(response)).error.code).toBe('UNAUTHORIZED');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('gives an identical response for an unknown email, so accounts cannot be enumerated', async () => {
    const candidate = await createCandidate({ email: 'sam@example.com' });

    const wrongPassword = await login(
      jsonRequest('/api/auth/login', {
        method: 'POST',
        body: { email: candidate.email, password: 'Wr0ngPassword' },
      }),
      emptyContext,
    );
    const unknownEmail = await login(
      jsonRequest('/api/auth/login', {
        method: 'POST',
        body: { email: 'nobody@example.com', password: 'Wr0ngPassword' },
      }),
      emptyContext,
    );

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(await readJson<ApiError>(unknownEmail)).toEqual(
      await readJson<ApiError>(wrongPassword),
    );
  });

  it('rate limits repeated failed logins', async () => {
    const attempt = () =>
      login(
        jsonRequest('/api/auth/login', {
          method: 'POST',
          body: { email: 'sam@example.com', password: 'Wr0ngPassword' },
          headers: { 'x-forwarded-for': '198.51.100.7' },
        }),
        emptyContext,
      );

    for (let index = 0; index < 10; index += 1) {
      expect((await attempt()).status).toBe(401);
    }

    expect((await attempt()).status).toBe(429);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the signed-in user', async () => {
    const candidate = await createCandidate();

    const response = await me(
      jsonRequest('/api/auth/me', { cookie: candidate.cookie }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect((await readJson<ApiData<PublicUser>>(response)).data.id).toBe(candidate.id);
  });

  it('returns 401 without a session cookie', async () => {
    const response = await me(jsonRequest('/api/auth/me'), emptyContext);
    expect(response.status).toBe(401);
  });

  it('returns 401 for a tampered token', async () => {
    const candidate = await createCandidate();
    const tampered = `${candidate.cookie.slice(0, -3)}abc`;

    const response = await me(jsonRequest('/api/auth/me', { cookie: tampered }), emptyContext);
    expect(response.status).toBe(401);
  });

  it('returns 401 when the account behind a valid token is gone', async () => {
    const response = await me(
      jsonRequest('/api/auth/me', { cookie: await cookieForDeletedUser() }),
      emptyContext,
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('expires the session cookie', async () => {
    const candidate = await createCandidate();

    const response = await logout(
      jsonRequest('/api/auth/logout', { method: 'POST', cookie: candidate.cookie }),
      emptyContext,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});

describe('session token issuer', () => {
  /*
   * The issuer moved from 'job-application-tracker' to 'shortlist' when the
   * product was renamed, which is what signs every pre-rename session out.
   * Nothing asserted the issuer before, so that rename was invisible to the
   * suite — this pins the rejection so a future change to the string is a
   * deliberate one that also logs everyone out.
   */
  it('rejects a token signed with the old issuer', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const issuedAt = Math.floor(Date.now() / 1000);

    const staleToken = await new SignJWT({ email: 'ada@example.com', role: 'CANDIDATE' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('000000000000000000000000')
      .setIssuer('job-application-tracker')
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + 3600)
      .sign(secret);

    expect(await verifySessionToken(staleToken)).toBeNull();
  });

  it('accepts a token the current signer produced', async () => {
    const candidate = await createCandidate();
    const token = candidate.cookie.split('=').slice(1).join('=');

    expect(await verifySessionToken(token)).not.toBeNull();
  });
});
