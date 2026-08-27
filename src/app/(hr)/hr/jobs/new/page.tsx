import Link from 'next/link';

import { JobForm } from '@/components/job-form';
import { requirePageUser } from '@/modules/auth/session';

export const metadata = { title: 'Post a job · Job Application Tracker' };

export default async function NewJobPage() {
  await requirePageUser('HR');

  return (
    <>
      <Link href="/hr/jobs" className="text-sm text-brand-600 hover:underline">
        ← Back to my listings
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-semibold">Post a job</h1>
      <JobForm />
    </>
  );
}
