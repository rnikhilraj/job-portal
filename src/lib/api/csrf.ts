import type { NextRequest } from 'next/server';

import { ForbiddenError } from '@/lib/api/errors';

/**
 * Cross-site request forgery defence, layered on top of the session cookie's
 * `SameSite=lax`.
 *
 * SameSite=lax already stops a cross-site form POST in every current browser,
 * and it is the primary control. This is the second one, for the cases it does
 * not cover: a browser old enough to predate SameSite, a bug in the browser's
 * own enforcement, or a future change here that loosens the cookie to
 * `SameSite=none` for an embedding use case and forgets what it was buying.
 *
 * The check is an Origin comparison rather than a synchroniser token because a
 * token would need to be minted, stored and threaded through every form for the
 * same guarantee. A token is worth more when it is the *only* control; here it
 * would duplicate what the cookie attribute already does.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * A missing `Origin` is allowed, deliberately, and that is not the hole it looks
 * like.
 *
 * Browsers attach `Origin` to every cross-origin request, including the form
 * POST that a CSRF attack has to use, and page JavaScript cannot override it —
 * it is on the forbidden header list. So a request arriving without one did not
 * come from a browser acting on another site's behalf; it came from curl, a
 * mobile client or a server, none of which carry the victim's ambient cookies.
 * Rejecting the absent case would break every non-browser caller while blocking
 * nothing a browser can actually do.
 */
export function assertSameOrigin(request: NextRequest): void {
  if (!MUTATING_METHODS.has(request.method)) return;

  const origin = request.headers.get('origin');
  if (!origin) return;

  // `null` is what a sandboxed iframe or a redirected cross-origin form sends.
  // It is never this app's own origin, so it is refused rather than parsed.
  if (origin === 'null') {
    throw new ForbiddenError('That request did not come from this site.');
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenError('That request did not come from this site.');
  }

  /*
   * Compared against the Host header, which is what the browser resolved and
   * connected to. Behind a reverse proxy that rewrites Host, the trusted value
   * is whatever that proxy sets — X-Forwarded-Host is attacker-controlled with
   * nothing in front, so it is deliberately not consulted here. This is the
   * same reasoning clientKey() applies to X-Forwarded-For in lib/rate-limit.ts.
   */
  const host = request.headers.get('host') ?? request.nextUrl.host;

  if (originHost !== host) {
    throw new ForbiddenError('That request did not come from this site.');
  }
}
