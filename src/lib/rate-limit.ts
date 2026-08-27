import { RateLimitError } from '@/lib/api/errors';

/**
 * Minimal fixed-window rate limiter for credential endpoints, kept in process
 * memory. This is deliberately simple: it blunts online password guessing from
 * a single client without adding infrastructure. It does NOT coordinate across
 * replicas — see the README's known limitations.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

function pruneExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/** Throws a RateLimitError (HTTP 429) once the caller exceeds the window. */
export function enforceRateLimit(key: string, { limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();

  if (windows.size > MAX_TRACKED_KEYS) pruneExpired(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > limit) {
    const seconds = Math.ceil((existing.resetAt - now) / 1000);
    throw new RateLimitError(`Too many attempts. Try again in ${seconds}s.`);
  }
}

/** Test-only helper so suites do not leak counters into each other. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * Best-effort client identifier. Behind a proxy the first X-Forwarded-For hop
 * is used; otherwise all direct callers share one bucket.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}
