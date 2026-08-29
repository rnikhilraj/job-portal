import Link from 'next/link';

import { JobForm } from '@/components/job-form';
import { requirePageUser } from '@/modules/auth/session';

export const metadata = { title: 'Post a listing' };

export default async function NewJobPage() {
  await requirePageUser('HR');

  return (
    <>
      <Link href="/hr/jobs" className="link text-sm">
        <span aria-hidden="true">←</span> Back to my listings
      </Link>
      <header className="mb-6 mt-4">
        <h1 className="page-title">Post a listing</h1>
        <p className="page-lede">
          Candidates see the title, location, type and full description. You can close the listing later without deleting it.
        </p>
      </header>
      <JobForm />
    </>
  );
}
