import { expect, test, type Page } from '@playwright/test';

import { CANDIDATE } from './fixtures';

/**
 * The post-sign-in redirect, in a real browser.
 *
 * This is the one behaviour in the app that genuinely needs one. The unit tests
 * prove `safeRedirectPath` classifies a URL correctly and the component tests
 * prove the form calls it, but neither can prove what a browser *does* with the
 * result — and the bug being guarded against is precisely a browser leaving the
 * origin. Only navigating for real closes that gap.
 */
async function signIn(page: Page): Promise<void> {
  await page.getByLabel('Email').fill(CANDIDATE.email);
  await page.getByLabel('Password').fill(CANDIDATE.password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test.describe('post-sign-in redirect', () => {
  test('honours a legitimate next, filters included', async ({ page }) => {
    await page.goto('/login?next=%2Fjobs%3Fq%3Dengineer');

    await signIn(page);

    await page.waitForURL('**/jobs?q=engineer');
    expect(new URL(page.url()).searchParams.get('q')).toBe('engineer');
    await expect(page.getByRole('heading', { name: 'Open roles' })).toBeVisible();
  });

  /**
   * Each of these is a link an attacker can hand to a victim. The sign-in
   * succeeds either way; the question is only whether the browser is then
   * handed to somebody else's site with the user's trust freshly established.
   */
  const hostileDestinations = [
    { label: 'an absolute URL', value: 'https://example.com/' },
    { label: 'a scheme-relative URL', value: '//example.com' },
    { label: 'a backslash the URL parser rewrites', value: '/\\example.com' },
  ];

  for (const { label, value } of hostileDestinations) {
    test(`refuses ${label} and lands on the candidate's own home`, async ({ page, baseURL }) => {
      await page.goto(`/login?next=${encodeURIComponent(value)}`);

      await signIn(page);

      // Landed on the role default rather than the supplied destination.
      await page.waitForURL('**/jobs');
      await expect(page.getByRole('heading', { name: 'Open roles' })).toBeVisible();

      // And never left this origin on the way — the assertion the unit and
      // component tests structurally cannot make.
      expect(new URL(page.url()).host).toBe(new URL(baseURL as string).host);
      expect(page.url()).not.toContain('example.com');
    });
  }

  test('carries the destination across when you switch to signup', async ({ page }) => {
    await page.goto('/login?next=%2Fapplications');

    // Scoped to the form's own card: the site header carries a second "Sign up"
    // link, and an unscoped lookup matches both.
    await page.getByRole('main').getByRole('link', { name: 'Sign up' }).click();

    await page.waitForURL('**/signup**');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/applications');
  });

  test('drops a hostile destination rather than passing it between pages', async ({ page }) => {
    await page.goto('/login?next=https%3A%2F%2Fexample.com');

    await page.getByRole('main').getByRole('link', { name: 'Sign up' }).click();

    await page.waitForURL('**/signup**');
    // The link is built through the same validator, so the bad value does not
    // survive the hop and cannot be laundered by bouncing through signup.
    expect(new URL(page.url()).searchParams.get('next')).toBeNull();
  });
});

test.describe('the guard that creates the next parameter', () => {
  test('sends an anonymous visitor to login and brings them back', async ({ page }) => {
    await page.goto('/applications');

    await page.waitForURL('**/login**');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/applications');

    await signIn(page);

    // Back to where they were originally going, not the generic home.
    await page.waitForURL('**/applications');
    await expect(page.getByRole('heading', { name: 'My applications' })).toBeVisible();
  });
});
