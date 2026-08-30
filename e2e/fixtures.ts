import path from 'node:path';

/**
 * The seeded demo accounts, as documented in the README and created by
 * `src/lib/seed.ts` on boot.
 *
 * Read from the environment with the `.env.example` values as the fallback, so
 * a stack booted with different seed passwords can still be tested without
 * editing this file. These are demo credentials for a local stack, not secrets.
 */
export const CANDIDATE = {
  email: 'candidate@example.com',
  password: process.env.SEED_CANDIDATE_PASSWORD ?? 'Cand@Passw0rd123',
} as const;

export const HR = {
  email: 'hr1@example.com',
  password: process.env.SEED_HR_PASSWORD ?? 'Hr@Passw0rd123',
} as const;

/**
 * Where the setup project saves each role's signed-in session.
 *
 * These live here rather than in auth.setup.ts because Playwright refuses to
 * let one test file import another, and both the setup that writes them and the
 * specs that read them need the paths.
 */
export const STATE_DIR = path.join(process.cwd(), '.playwright');
export const CANDIDATE_STATE = path.join(STATE_DIR, 'candidate.json');
export const HR_STATE = path.join(STATE_DIR, 'hr.json');
