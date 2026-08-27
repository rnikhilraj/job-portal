/**
 * Standalone seeding entry point for local development:
 *   npm run seed
 *
 * Inside Docker this is unnecessary — `src/instrumentation.ts` seeds on boot.
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const { seedDatabase } = await import('@/lib/seed');
  const { disconnectFromDatabase } = await import('@/lib/db');

  try {
    const summary = await seedDatabase();
    console.info(
      `Seed complete — ${summary.usersCreated} user(s), ${summary.jobsCreated} job(s) created.`,
    );
  } finally {
    await disconnectFromDatabase();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
