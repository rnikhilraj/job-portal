import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CandidateSummary } from '@/components/candidate-summary';
import { AppError } from '@/lib/api/errors';
import { objectIdSchema } from '@/lib/validation';
import { requirePageUser } from '@/modules/auth/session';
import { findDiscoverableCandidate } from '@/modules/users/user.service';

export const metadata = { title: 'Candidate · Job Application Tracker' };

/**
 * One opted-in candidate's profile.
 *
 * findDiscoverableCandidate() re-reads the opt-in on every render, so this page
 * cannot show a cached view of somebody who has since opted out.
 */
export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageUser('HR');

  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  let candidate;
  try {
    candidate = await findDiscoverableCandidate(id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  return (
    <article>
      <Link href="/hr/candidates" className="text-sm text-brand-600 hover:underline">
        ← Back to candidate search
      </Link>

      <div className="card mt-4">
        <CandidateSummary candidate={candidate} linkToDetail={false} />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        This candidate has opted in to recruiter visibility. If they turn it off, this page and
        their resume link stop working immediately.
      </p>
    </article>
  );
}
