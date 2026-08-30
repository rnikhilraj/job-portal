import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, run against the Compose stack rather than a dev server.
 *
 * Everything else in this repo is tested below the browser: Jest drives route
 * handlers directly and renders components into jsdom. Both are faster and more
 * precise than a browser, and neither can see the things that only exist in
 * one — a client-side navigation actually happening, a redirect landing on the
 * origin it claims, a role gate resolving before the page paints.
 *
 * The suite is deliberately small. It covers the paths where being wrong is
 * expensive and where nothing below the browser can confirm the answer; it is
 * not a second copy of the component tests.
 *
 * It expects the app already running on BASE_URL — `docker compose up -d`
 * locally, and the stack the `docker` CI job has already booted and proven
 * healthy. No webServer block, because starting a second copy of the app on top
 * of that one is how an e2e suite starts failing for reasons of its own.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // Every spec signs in and asserts on seeded data, so they share one database.
  // Running them in parallel would let one test's session or navigation race
  // another's. The suite is small enough that serial costs seconds.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Signs in once per role and saves the session for the specs that only need
    // to be someone. See e2e/auth.setup.ts for why that matters beyond speed.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
});
