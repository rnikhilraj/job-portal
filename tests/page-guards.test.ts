/**
 * Page-level authorization guards (`src/modules/auth/session.ts`).
 *
 * These are the only thing standing between a candidate and every HR page, and
 * they were previously untested — a regression that silently downgraded the
 * guard's redirect to a client-side one survived a full green test run. The
 * suite pins the redirect *target and status* for every wrong-role and
 * signed-out combination, not merely that "something threw".
 *
 * Server components have no NextRequest, so these read the session through
 * `cookies()` from next/headers. Jest has no request scope, so that module is
 * mocked; everything below it — JWT verification, the database read, the role
 * comparison — is the real implementation.
 */
import { SESSION_COOKIE_NAME } from '@/modules/auth/cookie';
import { getCurrentUser, getServerSession, requirePageUser } from '@/modules/auth/session';
import { User, type UserRole } from '@/modules/users/user.model';

/** Mutable stand-in for the request's cookie jar. `mock` prefix satisfies jest hoisting. */
const mockCookieJar: { token: string | undefined } = { token: undefined };

jest.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'session' && mockCookieJar.token !== undefined
        ? { name, value: mockCookieJar.token }
        : undefined,
  }),
}));

import { createCandidate, createHr } from './helpers/auth';

type Redirect = { url: string; status: number };

/**
 * Next signals a redirect by throwing an error carrying a digest of the form
 * `NEXT_REDIRECT;replace;/login;307;`. Anything else is re-thrown so a genuine
 * bug is never mistaken for a redirect.
 */
async function captureRedirect(run: () => Promise<unknown>): Promise<Redirect | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT')) throw error;

    const [, , url, status] = digest.split(';');
    return { url: url ?? '', status: Number(status) };
  }
}

/** Puts a real signed session cookie in the jar, exactly as the browser would send it. */
function signIn(cookieHeader: string): void {
  mockCookieJar.token = cookieHeader.slice(`${SESSION_COOKIE_NAME}=`.length);
}

function signOut(): void {
  mockCookieJar.token = undefined;
}

beforeEach(signOut);

describe('getServerSession', () => {
  it('returns null when there is no cookie at all', async () => {
    expect(await getServerSession()).toBeNull();
  });

  it('returns null for an empty cookie value', async () => {
    mockCookieJar.token = '';
    expect(await getServerSession()).toBeNull();
  });

  it('returns the payload for a validly signed cookie', async () => {
    const candidate = await createCandidate();
    signIn(candidate.cookie);

    expect(await getServerSession()).toEqual({
      userId: candidate.id,
      email: candidate.email,
      role: 'CANDIDATE',
    });
  });

  it('returns null for a tampered token rather than trusting it', async () => {
    const candidate = await createCandidate();
    signIn(`${candidate.cookie.slice(0, -3)}abc`);

    expect(await getServerSession()).toBeNull();
  });
});

describe('getCurrentUser', () => {
  it('returns null when signed out', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('resolves the user document for a valid session', async () => {
    const hr = await createHr();
    signIn(hr.cookie);

    const user = await getCurrentUser();
    expect(String(user?._id)).toBe(hr.id);
    expect(user?.role).toBe('HR');
  });

  it('returns null when the account behind a still-valid token is gone', async () => {
    const candidate = await createCandidate();
    signIn(candidate.cookie);
    await User.deleteOne({ _id: candidate.id });

    expect(await getCurrentUser()).toBeNull();
  });
});

describe('requirePageUser — signed out', () => {
  it.each([
    ['no role required', undefined],
    ['HR required', 'HR' as const],
    ['CANDIDATE required', 'CANDIDATE' as const],
  ])('redirects to /login when %s', async (_label, role) => {
    const redirect = await captureRedirect(() => requirePageUser(role));

    expect(redirect).toEqual({ url: '/login', status: 307 });
  });

  it('redirects to /login for a tampered cookie, not into the page', async () => {
    const hr = await createHr();
    signIn(`${hr.cookie.slice(0, -3)}zzz`);

    expect(await captureRedirect(() => requirePageUser('HR'))).toEqual({
      url: '/login',
      status: 307,
    });
  });

  it('redirects to /login when the token is valid but the account was deleted', async () => {
    const hr = await createHr();
    signIn(hr.cookie);
    await User.deleteOne({ _id: hr.id });

    expect(await captureRedirect(() => requirePageUser('HR'))).toEqual({
      url: '/login',
      status: 307,
    });
  });
});

describe('requirePageUser — wrong role', () => {
  it('sends a candidate away from an HR page, to their own home', async () => {
    const candidate = await createCandidate();
    signIn(candidate.cookie);

    // /jobs, not /login: they are signed in, just not entitled to this page.
    expect(await captureRedirect(() => requirePageUser('HR'))).toEqual({
      url: '/jobs',
      status: 307,
    });
  });

  it('sends an HR user away from a candidate-only page, to their own home', async () => {
    const hr = await createHr();
    signIn(hr.cookie);

    expect(await captureRedirect(() => requirePageUser('CANDIDATE'))).toEqual({
      url: '/hr/jobs',
      status: 307,
    });
  });

  it('never reveals whether the page exists — the redirect is the same either way', async () => {
    const candidate = await createCandidate();
    signIn(candidate.cookie);

    const first = await captureRedirect(() => requirePageUser('HR'));
    const second = await captureRedirect(() => requirePageUser('HR'));

    expect(first).toEqual(second);
  });

  it('honours a role demotion made after the token was issued', async () => {
    // The JWT still claims HR; the database is the authority.
    const hr = await createHr();
    signIn(hr.cookie);
    await User.updateOne({ _id: hr.id }, { role: 'CANDIDATE' });

    expect(await captureRedirect(() => requirePageUser('HR'))).toEqual({
      url: '/jobs',
      status: 307,
    });
  });
});

describe('requirePageUser — authorised', () => {
  it.each<[UserRole]>([['HR'], ['CANDIDATE']])(
    'returns the %s user when the role matches',
    async (role) => {
      const account = role === 'HR' ? await createHr() : await createCandidate();
      signIn(account.cookie);

      const user = await requirePageUser(role);

      expect(String(user._id)).toBe(account.id);
      expect(user.role).toBe(role);
    },
  );

  it.each<[UserRole]>([['HR'], ['CANDIDATE']])(
    'lets a %s through when no particular role is required',
    async (role) => {
      const account = role === 'HR' ? await createHr() : await createCandidate();
      signIn(account.cookie);

      // Pages such as /jobs and /profile are deliberately open to both roles.
      const user = await requirePageUser();

      expect(String(user._id)).toBe(account.id);
    },
  );

  it('returns a live document, so the caller sees current data not token claims', async () => {
    const candidate = await createCandidate();
    signIn(candidate.cookie);
    await User.updateOne({ _id: candidate.id }, { name: 'Renamed After Login' });

    const user = await requirePageUser('CANDIDATE');

    expect(user.name).toBe('Renamed After Login');
  });
});
