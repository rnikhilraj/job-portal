import { connectToDatabase } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { hashPassword } from '@/modules/auth/password';
import { Job, type JobType } from '@/modules/jobs/job.model';
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

/** Sample listings, keyed by the email of the HR user who owns them. */
type SeedJob = {
  ownerEmail: string;
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  status?: 'OPEN' | 'CLOSED';
};

const SEED_JOBS: SeedJob[] = [
  {
    ownerEmail: 'hr1@example.com',
    title: 'Senior Backend Engineer',
    description:
      'Design and operate the services behind our payments platform. You will own APIs end to end, from schema design through deployment and on-call. We work in TypeScript and Go against MongoDB and Postgres.',
    location: 'Bengaluru, India',
    jobType: 'FULL_TIME',
  },
  {
    ownerEmail: 'hr1@example.com',
    title: 'Frontend Engineer (React)',
    description:
      'Build the candidate-facing surfaces of our hiring product. Strong React and TypeScript skills expected, along with a real eye for accessible, responsive interfaces.',
    location: 'Remote (India)',
    jobType: 'REMOTE',
  },
  {
    ownerEmail: 'hr1@example.com',
    title: 'Engineering Intern - Platform',
    description:
      'A six-month internship on the platform team. You will ship real infrastructure work with a mentor, covering CI pipelines, container builds and observability.',
    location: 'Pune, India',
    jobType: 'INTERNSHIP',
  },
  {
    ownerEmail: 'hr1@example.com',
    title: 'Site Reliability Engineer (closed)',
    description:
      'This listing is already filled and is seeded as CLOSED so the status filter on the HR listings page has something to show.',
    location: 'Hyderabad, India',
    jobType: 'FULL_TIME',
    status: 'CLOSED',
  },
  {
    ownerEmail: 'hr2@example.com',
    title: 'Data Analyst',
    description:
      'Turn product and hiring funnel data into decisions. Comfortable with SQL, Python and dashboarding, and able to explain findings to non-technical stakeholders.',
    location: 'Mumbai, India',
    jobType: 'FULL_TIME',
  },
  {
    ownerEmail: 'hr2@example.com',
    title: 'Technical Writer',
    description:
      'Own our developer documentation. This is a part-time contract role suited to someone who enjoys reading source code and turning it into clear prose.',
    location: 'Remote (worldwide)',
    jobType: 'PART_TIME',
  },
];

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
