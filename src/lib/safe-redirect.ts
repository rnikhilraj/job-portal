/**
 * Validation for caller-supplied post-sign-in destinations.
 *
 * `src/middleware.ts` sends an anonymous visitor to `/login?next=<where they
 * were going>`, and the login form sends them on after a successful sign-in.
 * That query parameter is attacker-controlled: anyone can hand out a link with
 * any `next` they like. Passing it to `router.replace()` unchecked is an open
 * redirect, and the dangerous version of one — the bounce happens *after* a
 * genuine sign-in, so the victim has just proven the site is real and is primed
 * to trust whatever it hands them to next.
 *
 * This module is dependency-free on purpose: it is imported by a client
 * component, so anything it pulls in ships to the browser.
 */

/**
 * A base that cannot collide with a real origin. `.invalid` is reserved by
 * RFC 2606 precisely so it can never resolve, and the scheme is fixed here so
 * the comparison below does not depend on how the page happens to be served.
 */
const INTERNAL_BASE = 'https://internal.invalid';

/**
 * Reduces a `?next=` value to a same-origin path, or null if it is not one.
 *
 * The check is delegated to the WHATWG URL parser rather than done with string
 * comparisons, because the ways to write an off-origin URL that *looks* rooted
 * are not obvious and not worth re-deriving: `//evil.com` is scheme-relative,
 * and `/\evil.com` reaches the same place because the parser normalises a
 * backslash to a slash in a special scheme. Both start with `/`. Resolving
 * against a fixed base and demanding the origin survive catches those, plus
 * `javascript:` and `data:` (which parse to an opaque origin), without this
 * file having to enumerate them.
 *
 * The leading-slash requirement is kept as well, so a bare relative value like
 * `jobs` is rejected rather than quietly resolved — callers should be explicit.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/')) return null;

  let url: URL;
  try {
    url = new URL(raw, INTERNAL_BASE);
  } catch {
    // Not reachable from here on Node 22: with a valid base, no value starting
    // with `/` was found to make the parser throw — lone surrogates, nulls,
    // stray `%` and a 200k-character path all parse. Kept because that is a
    // property of the parser rather than a guarantee of the spec, and the cost
    // of being wrong is an unhandled exception in the sign-in path. It shows up
    // as the one uncovered line in this file, and that is the honest reason.
    return null;
  }

  if (url.origin !== INTERNAL_BASE) return null;

  // Rebuilt from the parsed parts rather than returned as received, so the
  // value handed to the router is normalised and carries no credentials.
  return `${url.pathname}${url.search}${url.hash}`;
}
