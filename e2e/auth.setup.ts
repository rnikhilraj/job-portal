import { expect, test as setup } from '@playwright/test';

import { CANDIDATE, CANDIDATE_STATE, HR, HR_STATE } from './fixtures';

/**
 * Signs in once per role and saves the session, so the specs that merely need
 * to *be* someone do not each spend a login.
 *
 * This is not only a speed optimisation. Login is rate limited to 10 attempts
 * per 15 minutes per IP, and the whole suite arrives from one address — an
 * earlier version signed in eleven times and the eleventh got a correct 429,
 * which reads as a test failure but was the product working. Signing in for
 * real is left to the specs that are actually testing sign-in.
 *
 * If you add a spec that logs in directly, keep the total under that limit. The
 * counters live in the app's process memory, so `docker compose restart app`
 * clears them if a run does trip it.
 */
setup('sign in as the seeded candidate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(CANDIDATE.email);
  await page.getByLabel('Password').fill(CANDIDATE.password);
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.waitForURL('**/jobs');
  await expect(page.getByRole('heading', { name: 'Open roles' })).toBeVisible();

  await page.context().storageState({ path: CANDIDATE_STATE });
});

setup('sign in as the seeded HR user', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(HR.email);
  await page.getByLabel('Password').fill(HR.password);
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.waitForURL('**/hr/jobs');
  await expect(page.getByRole('heading', { name: 'My job listings' })).toBeVisible();

  await page.context().storageState({ path: HR_STATE });
});
