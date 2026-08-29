/**
 * The demo dataset's listings, in a dependency-free module.
 *
 * These are the same records `src/lib/seed.ts` writes on first run, lifted out
 * of it so the landing page can show them without importing the seeder — which
 * reaches Mongoose, and would put the driver back in the browser bundle. The
 * seeder imports this file rather than owning the list, so the marketing page
 * and the database can never drift apart.
 *
 * Nothing here is a customer or a partner. They are fixtures, and the landing
 * page says so in as many words.
 */
import type { JobStatus, JobType } from './job.constants';

export type SampleJob = {
  /** Which seeded HR account owns the listing. */
  ownerEmail: SampleEmployerEmail;
  title: string;
  description: string;
  location: string;
  jobType: JobType;
  status?: JobStatus;
};

export type SampleEmployerEmail = 'hr1@example.com' | 'hr2@example.com';

/**
 * The fictional organisations behind the seeded HR accounts. Their names live
 * here rather than inline in each account's headline so the listing cards and
 * the seeded profiles quote the same string.
 */
export const SAMPLE_EMPLOYERS: Record<SampleEmployerEmail, { org: string; title: string }> = {
  'hr1@example.com': { org: 'Northwind Labs', title: 'Talent Partner' },
  'hr2@example.com': { org: 'Aurora Systems', title: 'Recruiting Lead' },
};

export function sampleEmployerHeadline(email: SampleEmployerEmail): string {
  const employer = SAMPLE_EMPLOYERS[email];
  return `${employer.title}, ${employer.org}`;
}

/**
 * The listing the landing hero rides an application against. Named rather than
 * indexed out of the array below so the hero gets a defined `SampleJob` and not
 * a possibly-undefined lookup — and so reordering the list cannot silently
 * change what the hero advertises.
 */
export const FEATURED_SAMPLE_JOB: SampleJob = {
  ownerEmail: 'hr1@example.com',
  title: 'Senior Backend Engineer',
  description:
    'Design and operate the services behind our payments platform. You will own APIs end to end, from schema design through deployment and on-call. We work in TypeScript and Go against MongoDB and Postgres.',
  location: 'Bengaluru, India',
  jobType: 'FULL_TIME',
};

export const SAMPLE_JOBS: SampleJob[] = [
  FEATURED_SAMPLE_JOB,
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
