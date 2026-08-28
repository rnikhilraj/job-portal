import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApplyForm } from '@/components/apply-form';
import { PipelineRail, StatusChip } from '@/components/pipeline';
import { StatusBadge } from '@/components/status-badge';
import { NotFoundError } from '@/lib/api/errors';
import { getEnv } from '@/lib/env';
import { objectIdSchema } from '@/lib/validation';
import { findCandidateApplicationForJob } from '@/modules/applications/application.service';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.constants';
import { findJobForViewer } from '@/modules/jobs/job.service';

export const metadata = { title: 'Job detail' };

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();

  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  let job;
  try {
    job = await findJobForViewer(id, { id: user._id, role: user.role });
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const isCandidate = user.role === 'CANDIDATE';
  const existingApplication = isCandidate
    ? await findCandidateApplicationForJob(job.id, user._id)
    : null;

  return (
    <article>
      <Link href="/jobs" className="link text-sm">
        <span aria-hidden="true">←</span> Back to jobs
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="page-title">{job.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">◎</span>
              {job.location}
            </span>
            <span aria-hidden="true" className="text-mist-400">
              ·
            </span>
            <span>{JOB_TYPE_LABELS[job.jobType]}</span>
            <span aria-hidden="true" className="text-mist-400">
              ·
            </span>
            <span>Posted {new Date(job.createdAt).toLocaleDateString()}</span>
          </p>
        </div>
        <StatusBadge status={job.status} />
      </header>

      <section className="card mt-6">
        <h2 className="eyebrow">Description</h2>
        {/* Rendered as text, never as HTML, so a listing cannot inject markup. */}
        <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-ink-soft">
          {job.description}
        </p>
      </section>

      {isCandidate ? (
        <section className="card mt-6">
          {existingApplication ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="section-title">Your application</h2>
                <StatusChip status={existingApplication.status} />
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                You applied to this role. Its current stage is shown below.
              </p>
              <PipelineRail status={existingApplication.status} className="mt-5 max-w-md" />
              <Link href="/applications" className="btn-secondary btn-sm mt-6">
                View all my applications
              </Link>
            </>
          ) : job.status === 'OPEN' ? (
            <>
              <h2 className="section-title">Apply for this role</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                Attach your resume as a PDF. A cover note is optional but helps.
              </p>
              <div className="mt-5">
                <ApplyForm jobId={job.id} maxResumeBytes={getEnv().MAX_RESUME_BYTES} />
              </div>
            </>
          ) : (
            <>
              <h2 className="section-title">Applications closed</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                This listing is no longer accepting applications.
              </p>
            </>
          )}
        </section>
      ) : null}
    </article>
  );
}
