import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JobForm } from '@/components/job-form';
import { AppError } from '@/lib/api/errors';
import { objectIdSchema } from '@/lib/validation';
import { requirePageUser } from '@/modules/auth/session';
import { toPublicJob } from '@/modules/jobs/job.model';
import { findOwnedJobOrFail } from '@/modules/jobs/job.service';

export const metadata = { title: 'Edit job · Job Application Tracker' };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const hr = await requirePageUser('HR');

  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  // findOwnedJobOrFail throws 403 for another HR user's listing and 404 when it
  // does not exist; the page renders a 404 for both so it never confirms that
  // someone else's listing id is real.
  let job;
  try {
    job = await findOwnedJobOrFail(id, hr._id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  return (
    <>
      <Link href="/hr/jobs" className="text-sm text-brand-600 hover:underline">
        ← Back to my listings
      </Link>
      <h1 className="mb-6 mt-4 text-2xl font-semibold">Edit job</h1>
      <JobForm job={toPublicJob(job)} />
    </>
  );
}
