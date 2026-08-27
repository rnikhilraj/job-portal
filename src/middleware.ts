import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/modules/auth/cookie';

/**
 * Convenience redirects only — NOT an authorization boundary.
 *
 * Middleware runs on the Edge runtime, where verifying the JWT would mean
 * shipping the signing secret into that bundle, so this checks cookie presence
 * alone. Every real access decision is made inside the route handlers and
 * server components via requireUser()/requireRole(), which verify the signature
 * and re-read the role from the database. A forged cookie gets past this file
 * and straight into a 401.
 */
const PROTECTED_PREFIXES = ['/jobs', '/applications', '/profile', '/hr'];
const AUTH_ROUTES = ['/login', '/signup'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSessionCookie && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSessionCookie && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip API routes (they answer with JSON status codes, never redirects),
  // Next internals and static assets.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
