import { middleware } from '@/middleware';
import { SESSION_COOKIE_NAME } from '@/modules/auth/cookie';

import { jsonRequest } from '../helpers/request';

/**
 * The middleware is a UX convenience, not an access-control boundary: it only
 * looks for the presence of a cookie. These tests pin that contract so nobody
 * later mistakes it for authorization.
 */
const signedIn = `${SESSION_COOKIE_NAME}=any-value-at-all`;

describe('middleware redirects', () => {
  it.each(['/jobs', '/jobs/abc', '/applications', '/profile', '/hr/jobs'])(
    'sends an anonymous visitor from %s to login with a return path',
    (path) => {
      const response = middleware(jsonRequest(path));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') ?? '');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe(path);
    },
  );

  it('preserves the query string in the return path', () => {
    const response = middleware(jsonRequest('/jobs?q=react&page=2'));
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.searchParams.get('next')).toBe('/jobs?q=react&page=2');
  });

  it('leaves public pages alone', () => {
    expect(middleware(jsonRequest('/')).headers.get('location')).toBeNull();
    expect(middleware(jsonRequest('/login')).headers.get('location')).toBeNull();
  });

  it('bounces a signed-in visitor away from the auth pages', () => {
    for (const path of ['/login', '/signup']) {
      const response = middleware(jsonRequest(path, { cookie: signedIn }));
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/');
    }
  });

  it('lets a request carrying any session cookie through to the route handler', () => {
    // A forged cookie passes here on purpose — requireUser() rejects it later.
    const response = middleware(jsonRequest('/hr/jobs', { cookie: signedIn }));
    expect(response.headers.get('location')).toBeNull();
  });
});
