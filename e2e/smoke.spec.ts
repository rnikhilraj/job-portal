import { expect, test } from '@playwright/test';

import { CANDIDATE_STATE, HR_STATE } from './fixtures';

/**
 * The paths a reviewer walks first, driven for real.
 *
 * Deliberately not a re-run of the component suite: each test here asserts
 * something that only exists once a browser, the server and the database are
 * all in play — a role gate resolving before the page paints, navigation
 * between server-rendered pages, the seeded data actually reaching the screen.
 *
 * These reuse a session saved by the setup project rather than signing in, so
 * they neither repeat what auth-redirect.spec.ts covers nor spend the login
 * rate-limit budget on setup.
 */

test('the landing page renders for an anonymous visitor', async ({ page }) => {
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('link', { name: 'Shortlist' })).toBeVisible();
});

test.describe('as a candidate', () => {
  test.use({ storageState: CANDIDATE_STATE });

  test('sees the seeded roles on the board', async ({ page }) => {
    await page.goto('/jobs');

    await expect(page.getByRole('heading', { name: 'Open roles' })).toBeVisible();
    // Seeding is what makes the demo reviewable, so its output is asserted
    // rather than assumed — an empty board means the seed silently failed.
    await expect(page.getByRole('listitem').first()).toBeVisible();
  });

  test('opens a role from the board', async ({ page }) => {
    await page.goto('/jobs');

    await page.getByRole('listitem').first().getByRole('link').first().click();

    await page.waitForURL(/\/jobs\/[a-f0-9]{24}/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('is kept out of the HR area by the server, not by a hidden link', async ({ page }) => {
    // Typed directly, the way someone probing the app would.
    await page.goto('/hr/jobs');

    // requirePageUser redirects to the candidate's own home rather than
    // rendering, and rather than admitting the page exists.
    await page.waitForURL('**/jobs');
    expect(page.url()).not.toContain('/hr/');
  });

  test('reaches their own applications', async ({ page }) => {
    await page.goto('/jobs');

    await page.getByRole('navigation', { name: 'Main' }).getByText('My applications').click();

    await page.waitForURL('**/applications');
    await expect(page.getByRole('heading', { name: 'My applications' })).toBeVisible();
  });
});

test.describe('as an HR user', () => {
  test.use({ storageState: HR_STATE });

  test('lands on their own listings', async ({ page }) => {
    await page.goto('/hr/jobs');

    await expect(page.getByRole('heading', { name: 'My listings' })).toBeVisible();
  });

  test('reaches the candidate directory', async ({ page }) => {
    await page.goto('/hr/jobs');

    await page.getByRole('navigation', { name: 'Main' }).getByText('Candidate search').click();

    await page.waitForURL('**/hr/candidates');
    // The directory is opt-in, so an empty result is correct here — what
    // matters is that the page renders for an HR account at all.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

test.describe('signing out', () => {
  test.use({ storageState: CANDIDATE_STATE });

  test('clears the session and re-protects the pages', async ({ page }) => {
    await page.goto('/jobs');

    // Scoped to the header: the mobile nav renders the same control, hidden at
    // this viewport but still in the tree.
    await page.getByRole('banner').getByRole('button', { name: 'Log out' }).click();

    // The session is genuinely gone, not just visually: a protected page
    // bounces back to login.
    await page.waitForURL((url) => !url.pathname.startsWith('/jobs'));
    await page.goto('/applications');
    await page.waitForURL('**/login**');
  });
});
