/**
 * Next.js runs `register()` once when the server starts. Two things happen here:
 *
 * 1. The environment is parsed eagerly, so a misconfigured deployment fails on
 *    boot instead of on the first request.
 * 2. The demo data is seeded when SEED_ON_BOOT is enabled, which is what makes
 *    `docker compose up --build` usable with no follow-up commands.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { getEnv } = await import('@/lib/env');
  const env = getEnv();

  if (!env.SEED_ON_BOOT) return;

  try {
    const { seedDatabase } = await import('@/lib/seed');
    const summary = await seedDatabase();
    console.info(
      `[seed] complete — ${summary.usersCreated} user(s), ${summary.jobsCreated} job(s) created`,
    );
  } catch (error) {
    // A seeding failure must not stop the server from serving traffic.
    console.error('[seed] failed', error);
  }
}
