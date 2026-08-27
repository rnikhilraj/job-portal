import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ApplyForm } from '@/components/apply-form';
import { StatusBadge } from '@/components/status-badge';
import { NotFoundError } from '@/lib/api/errors';
import { getEnv } from '@/lib/env';
import { objectIdSchema } from '@/lib/validation';
import { findCandidateApplicationForJob } from '@/modules/applications/application.service';
import { requirePageUser } from '@/modules/auth/session';
import { JOB_TYPE_LABELS } from '@/modules/jobs/job.model';
import { findJobForViewer } from '@/modules/jobs/job.service';

export const metadata = { title: 'Job detail · Job Application Tracker' };

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
      <Link href="/jobs" className="text-sm text-brand-600 hover:underline">
        ← Back to jobs
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{job.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {job.location} · {JOB_TYPE_LABELS[job.jobType]} · Posted{' '}
            {new Date(job.createdAt).toLocaleDateString()}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </header>

      <section className="card mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Description
        </h2>
        {/* Rendered as text, never as HTML, so a listing cannot inject markup. */}
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-800">
          {job.description}
        </p>
      </section>

      {isCandidate ? (
        <section className="card mt-6">
          <h2 className="text-lg font-semibold">Apply for this role</h2>

          {existingApplication ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-700">
                You have already applied to this job. Current status:{' '}
                <StatusBadge status={existingApplication.status} />
              </p>
              <Link href="/applications" className="btn-secondary">
                View my applications
              </Link>
            </div>
          ) : job.status === 'OPEN' ? (
            <div className="mt-4">
              <ApplyForm jobId={job.id} maxResumeBytes={getEnv().MAX_RESUME_BYTES} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              This listing is closed and is no longer accepting applications.
            </p>
          )}
        </section>
      ) : null}
    </article>
  );
}
