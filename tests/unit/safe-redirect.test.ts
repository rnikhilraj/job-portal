import { safeRedirectPath } from '@/lib/safe-redirect';

/**
 * The `?next=` parameter is the one piece of the sign-in flow a stranger can
 * set. These cases are the reason the helper delegates to the URL parser rather
 * than checking the string itself: half of them start with `/` and still leave
 * the origin.
 */
describe('safeRedirectPath — destinations it accepts', () => {
  it('keeps an ordinary in-app path', () => {
    expect(safeRedirectPath('/jobs')).toBe('/jobs');
    expect(safeRedirectPath('/hr/jobs')).toBe('/hr/jobs');
  });

  it('preserves the query string and hash, which carry the filters', () => {
    // This is the whole point of `next`: middleware puts the full path and
    // search on it, so a deep link survives the detour through login.
    expect(safeRedirectPath('/jobs?q=react&page=2')).toBe('/jobs?q=react&page=2');
    expect(safeRedirectPath('/jobs#results')).toBe('/jobs#results');
  });
});

describe('safeRedirectPath — destinations it refuses', () => {
  it('refuses an absolute URL on another origin', () => {
    expect(safeRedirectPath('https://evil.example/login')).toBeNull();
    expect(safeRedirectPath('http://evil.example')).toBeNull();
  });

  it('refuses a scheme-relative URL, which is off-origin despite the leading slash', () => {
    // `//evil.example` inherits the current scheme and changes the host. A
    // `startsWith('/')` check on its own would wave this straight through.
    expect(safeRedirectPath('//evil.example')).toBeNull();
    expect(safeRedirectPath('//evil.example/jobs')).toBeNull();
  });

  it('refuses a backslash, which the URL parser normalises to a slash', () => {
    // `/\evil.example` parses identically to `//evil.example`. This is the case
    // most hand-rolled validators miss.
    expect(safeRedirectPath('/\\evil.example')).toBeNull();
    expect(safeRedirectPath('/\\/evil.example')).toBeNull();
  });

  it('refuses a scheme that executes or inlines content', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBeNull();
    expect(safeRedirectPath('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('refuses anything not rooted, so a bare relative value is never guessed at', () => {
    expect(safeRedirectPath('jobs')).toBeNull();
    expect(safeRedirectPath('evil.example')).toBeNull();
  });

  it('refuses a missing or empty value', () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath('')).toBeNull();
  });
});
