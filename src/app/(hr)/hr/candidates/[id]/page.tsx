import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CandidateSummary } from '@/components/candidate-summary';
import { AppError } from '@/lib/api/errors';
import { objectIdSchema } from '@/lib/validation';
import { requirePageUser } from '@/modules/auth/session';
import { findDiscoverableCandidate } from '@/modules/users/user.service';

export const metadata = { title: 'Candidate' };

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
      <Link href="/hr/candidates" className="link text-sm">
        <span aria-hidden="true">←</span> Back to candidate search
      </Link>

      <div className="card mt-4">
        <CandidateSummary candidate={candidate} linkToDetail={false} />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-md bg-mist-200 px-3.5 py-2.5 text-xs leading-relaxed text-ink-muted">
        <span aria-hidden="true" className="mt-px">ℹ</span>
        <span>
          They chose to be listed here. If they change their mind, this page and their resume
          link stop working the moment they save — no cached copy, no grace period.
        </span>
      </p>
    </article>
  );
}
