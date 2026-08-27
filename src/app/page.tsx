import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/modules/auth/session';

/** Signed-in users go straight to their role's home; everyone else sees the pitch. */
export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === 'HR' ? '/hr/jobs' : '/jobs');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-semibold text-slate-900">Job Application Tracker</h1>
      <p className="mt-3 text-slate-600">
        Candidates browse openings, apply with a PDF resume, and follow their status. HR teams post
        listings and move applicants through review.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/login" className="btn-primary">
          Log in
        </Link>
        <Link href="/signup" className="btn-secondary">
          Create a candidate account
        </Link>
      </div>
    </main>
  );
}
