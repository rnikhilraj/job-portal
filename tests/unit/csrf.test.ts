import { assertSameOrigin } from '@/lib/api/csrf';
import { AppError } from '@/lib/api/errors';

import { jsonRequest } from '../helpers/request';

/**
 * The session cookie is `SameSite=lax`, which is the primary CSRF control. This
 * is the layer underneath it, so these tests are about the cases where the
 * cookie attribute is not doing the work: a hostile Origin that reaches the
 * handler anyway.
 *
 * `jsonRequest` builds against http://localhost:3000, so that is this app's
 * origin for the purposes of every case below.
 */
const OWN_ORIGIN = 'http://localhost:3000';

function attempt(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', origin?: string) {
  return () =>
    assertSameOrigin(
      jsonRequest('/api/jobs', {
        method,
        ...(origin === undefined ? {} : { headers: { origin } }),
      }),
    );
}

describe('assertSameOrigin — requests it refuses', () => {
  it.each(['POST', 'PATCH', 'DELETE'] as const)('refuses a cross-origin %s', (method) => {
    expect(attempt(method, 'https://evil.example')).toThrow(AppError);
  });

  it('answers 403 with a message that names the actual problem', () => {
    try {
      attempt('POST', 'https://evil.example')();
      throw new Error('should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.status).toBe(403);
      expect(appError.code).toBe('FORBIDDEN');
      expect(appError.message).toBe('That request did not come from this site.');
    }
  });

  it('refuses a sandboxed iframe, which sends the literal string null', () => {
    // Parsing `null` as a URL would throw anyway, but refusing it explicitly
    // keeps the reason legible.
    expect(attempt('POST', 'null')).toThrow(AppError);
  });

  it('refuses an unparseable Origin rather than letting it through', () => {
    expect(attempt('POST', 'not a url')).toThrow(AppError);
  });

  it('refuses a look-alike host that merely contains the real one', () => {
    // `localhost:3000.evil.example` and `evil-localhost:3000` both embed the
    // expected host as a substring. A `contains` check would pass them.
    expect(attempt('POST', 'http://localhost:3000.evil.example')).toThrow(AppError);
    expect(attempt('POST', 'http://notlocalhost:3000')).toThrow(AppError);
  });

  it('refuses the same host on a different port', () => {
    expect(attempt('POST', 'http://localhost:4000')).toThrow(AppError);
  });
});

describe('assertSameOrigin — requests it allows', () => {
  it('allows a write from this app’s own origin', () => {
    expect(attempt('POST', OWN_ORIGIN)).not.toThrow();
  });

  it('allows a write with no Origin at all', () => {
    // Not a hole: a browser always attaches Origin to a cross-site write and
    // page JavaScript cannot override it, so an absent one means a non-browser
    // caller — which carries no ambient cookies to forge with.
    expect(attempt('POST', undefined)).not.toThrow();
  });

  it('ignores reads entirely, whatever their Origin', () => {
    // A GET changes nothing, and blocking cross-origin reads here would break
    // ordinary navigation without preventing anything.
    expect(attempt('GET', 'https://evil.example')).not.toThrow();
  });
});
