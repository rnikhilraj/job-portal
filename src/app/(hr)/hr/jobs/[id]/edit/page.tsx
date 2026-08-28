import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JobForm } from '@/components/job-form';
import { AppError } from '@/lib/api/errors';
import { objectIdSchema } from '@/lib/validation';
import { requirePageUser } from '@/modules/auth/session';
import { toPublicJob } from '@/modules/jobs/job.model';
import { findOwnedJobOrFail } from '@/modules/jobs/job.service';

export const metadata = { title: 'Edit job' };

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
      <Link href="/hr/jobs" className="link text-sm">
        <span aria-hidden="true">←</span> Back to my listings
      </Link>
      <header className="mb-6 mt-4">
        <h1 className="page-title">Edit job</h1>
        <p className="page-lede">
          Changes are visible to candidates immediately. Set the status to Closed to stop accepting applications.
        </p>
      </header>
      <JobForm job={toPublicJob(job)} />
    </>
  );
}
