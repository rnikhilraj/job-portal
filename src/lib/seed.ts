import { connectToDatabase } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { storeResume, type ResumeFile } from '@/lib/resume-storage';
import { hashPassword } from '@/modules/auth/password';
import { Job } from '@/modules/jobs/job.model';
import {
  SAMPLE_JOBS,
  sampleEmployerHeadline,
} from '@/modules/jobs/job.samples';
import { User, type ExperienceLevel, type UserRole } from '@/modules/users/user.model';

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
  /** Candidate-only. Omitted means opted out, which is the real default. */
  isSearchable?: boolean;
  experienceLevel?: ExperienceLevel;
  /** Give this account a general profile resume so downloads are demonstrable. */
  withResume?: boolean;
};

/**
 * A minimal but structurally valid PDF, generated rather than committed as a
 * binary fixture. It only has to satisfy the same magic-byte check a real
 * upload does.
 */
function placeholderResume(name: string): File {
  const body = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj
% Placeholder resume for the seeded demo account: ${name}
trailer<</Root 1 0 R>>
%%EOF
`;
  return new File([new Uint8Array(Buffer.from(body, 'latin1'))], `${name}.pdf`, {
    type: 'application/pdf',
  });
}

function seedAccounts(): SeedAccount[] {
  const { SEED_HR_PASSWORD, SEED_CANDIDATE_PASSWORD } = getEnv();

  return [
    {
      email: 'hr1@example.com',
      name: 'Priya Menon',
      role: 'HR',
      password: SEED_HR_PASSWORD,
      headline: sampleEmployerHeadline('hr1@example.com'),
    },
    {
      email: 'hr2@example.com',
      name: 'Daniel Okafor',
      role: 'HR',
      password: SEED_HR_PASSWORD,
      headline: sampleEmployerHeadline('hr2@example.com'),
    },
    {
      // Seeded opted OUT on purpose: log in as this account, tick "Make my
      // profile visible to recruiters" on /profile, and watch the profile
      // appear in HR's candidate search.
      email: 'candidate@example.com',
      name: 'Sam Rivera',
      role: 'CANDIDATE',
      password: SEED_CANDIDATE_PASSWORD,
      headline: 'Full-stack engineer',
      skills: ['TypeScript', 'React', 'Node.js', 'MongoDB'],
      experienceLevel: 'MID',
    },
    {
      email: 'asha@example.com',
      withResume: true,
      name: 'Asha Nair',
      role: 'CANDIDATE',
      password: SEED_CANDIDATE_PASSWORD,
      headline: 'Backend engineer focused on distributed systems',
      skills: ['Go', 'PostgreSQL', 'Kafka', 'Kubernetes'],
      isSearchable: true,
      experienceLevel: 'SENIOR',
    },
    {
      email: 'marco@example.com',
      withResume: true,
      name: 'Marco Ferreira',
      role: 'CANDIDATE',
      password: SEED_CANDIDATE_PASSWORD,
      headline: 'Frontend developer who cares about accessibility',
      skills: ['React', 'TypeScript', 'CSS', 'Testing Library'],
      isSearchable: true,
      experienceLevel: 'MID',
    },
    {
      email: 'lena@example.com',
      withResume: true,
      name: 'Lena Fischer',
      role: 'CANDIDATE',
      password: SEED_CANDIDATE_PASSWORD,
      headline: 'Platform lead, ex-infrastructure',
      skills: ['Kubernetes', 'Terraform', 'Go', 'Observability'],
      isSearchable: true,
      experienceLevel: 'LEAD',
    },
    {
      // Also opted out, so the directory is visibly a subset of all accounts.
      email: 'tomas@example.com',
      name: 'Tomas Halonen',
      role: 'CANDIDATE',
      password: SEED_CANDIDATE_PASSWORD,
      headline: 'Data analyst',
      skills: ['SQL', 'Python', 'dbt'],
      experienceLevel: 'ENTRY',
    },
  ];
}

/**
 * The listings themselves live in `job.samples.ts`, which the landing page also
 * reads. Keeping one copy means the postings a visitor sees on the marketing
 * page are the postings this seeder actually writes.
 */
const SEED_JOBS = SAMPLE_JOBS;

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

    let resume: ResumeFile | undefined;
    if (account.withResume) {
      // Goes through the same validation and random-filename path as a real
      // upload, so the seeded files are indistinguishable from user ones.
      resume = await storeResume(placeholderResume(`${account.name} CV`));
    }

    await User.create({
      email: account.email,
      name: account.name,
      role: account.role,
      passwordHash: await hashPassword(account.password),
      headline: account.headline,
      skills: account.skills ?? [],
      isSearchable: account.isSearchable ?? false,
      experienceLevel: account.experienceLevel,
      resume,
    });
    usersCreated += 1;
  }

  let jobsCreated = 0;

  for (const seedJob of SEED_JOBS) {
    const owner = await User.findOne({ email: seedJob.ownerEmail, role: 'HR' }).select('_id');
    if (!owner) continue;

    // Title + owner is treated as the natural key for demo listings.
    const exists = await Job.exists({ title: seedJob.title, postedBy: owner._id });
    if (exists) continue;

    await Job.create({
      title: seedJob.title,
      description: seedJob.description,
      location: seedJob.location,
      jobType: seedJob.jobType,
      status: seedJob.status ?? 'OPEN',
      postedBy: owner._id,
    });
    jobsCreated += 1;
  }

  return { usersCreated, jobsCreated };
}
