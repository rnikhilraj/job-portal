import { connectToDatabase } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { hashPassword } from '@/modules/auth/password';
import { User, type UserRole } from '@/modules/users/user.model';

/**
 * Fixed demo accounts. HR users have no public signup route, so this seed is
 * the only way they come into existence. Passwords come from the environment
 * so a real deployment can change them without touching code.
 */
type SeedAccount = {
  email: string;
  name: string;
  role: UserRole;
  password: string;
  headline?: string;
  skills?: string[];
};

function seedAccounts(): SeedAccount[] {
  const { SEED_HR_PASSWORD, SEED_CANDIDATE_PASSWORD } = getEnv();

  return [
    {
      email: 'hr1@example.com',
      name: 'Priya Menon',
      role: 'HR',
      password: SEED_HR_PASSWORD,
      headline: 'Talent Partner, Northwind Labs',
    },
    {
      email: 'hr2@example.com',
      name: 'Daniel Okafor',
      role: 'HR',
      password: SEED_HR_PASSWORD,
      headline: 'Recruiting Lead, Aurora Systems',
    },
    {
      email: 'candidate@example.com',
      name: 'Sam Rivera',
      role: 'CANDIDATE',
      password: SEED_CANDIDATE_PASSWORD,
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'React', 'Node.js', 'MongoDB'],
    },
  ];
}

export type SeedSummary = { usersCreated: number; jobsCreated: number };

/**
 * Idempotent: existing accounts are left untouched, so restarting the container
 * never overwrites data a reviewer has already changed.
 */
export async function seedDatabase(): Promise<SeedSummary> {
  await connectToDatabase();

  let usersCreated = 0;

  for (const account of seedAccounts()) {
    const exists = await User.exists({ email: account.email });
    if (exists) continue;

    await User.create({
      email: account.email,
      name: account.name,
      role: account.role,
      passwordHash: await hashPassword(account.password),
      headline: account.headline,
      skills: account.skills ?? [],
    });
    usersCreated += 1;
  }

  return { usersCreated, jobsCreated: 0 };
}
