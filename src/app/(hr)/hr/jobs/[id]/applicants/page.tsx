import type { Types } from 'mongoose';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { ApplicantStatusSelect } from '@/components/applicant-status-select';
import { EmptyState } from '@/components/empty-state';
import { Pagination } from '@/components/pagination';
import { PageHeader } from '@/components/page-header';
import { PipelineFunnel } from '@/components/pipeline';
import { PipelineRail } from '@/components/pipeline-rail';
import { SkeletonList } from '@/components/skeleton';
import { AppError } from '@/lib/api/errors';
import { buildPageHref, toQueryRecord, type RawSearchParams } from '@/lib/query';
import { objectIdSchema } from '@/lib/validation';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from '@/modules/applications/application.constants';
import {
  applicantsQuerySchema,
  type ApplicantsQuery,
} from '@/modules/applications/application.schema';
import {
  countApplicantsByStatus,
  listApplicantsForJob,
} from '@/modules/applications/application.service';
import { requirePageUser } from '@/modules/auth/session';
import { findOwnedJobOrFail } from '@/modules/jobs/job.service';

export const metadata = { title: 'Applicants' };

export default async function ApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const hr = await requirePageUser('HR');

  const { id } = await params;
  if (!objectIdSchema.safeParse(id).success) notFound();

  // Ownership is resolved before anything is rendered; another HR user's
  // listing produces a 404 here rather than an applicant list.
  let job;
  try {
    job = await findOwnedJobOrFail(id, hr._id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }

  const rawParams = toQueryRecord(await searchParams);
  const parsed = applicantsQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : applicantsQuerySchema.parse({});

  const pipeline = await countApplicantsByStatus(id, hr._id);
  const basePath = `/hr/jobs/${id}/applicants`;
  const isFiltered = Boolean(query.q || query.status);

  return (
    <>
      <Link href="/hr/jobs" className="link text-sm">
        <span aria-hidden="true">←</span> Back to my listings
      </Link>

      <PageHeader
        eyebrow={job.location}
        title="Applicants"
        lede={job.title}
        className="mt-4"
      />

      {/*
        The recruiter's equivalent of the candidate's rail — the shape of this
        listing at a glance — so it earns the elevated panel treatment. That is
        two of the three places in the app that get it.
      */}
      <div className="enter-2 mb-6">
        <PipelineFunnel counts={pipeline.counts} total={pipeline.total} />
      </div>

      <form method="get" action={basePath} className="enter-3 card mb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="q" className="field-label">
              Candidate name
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ''}
              placeholder="Search by name"
              className="field-input"
            />
          </div>

          <div>
            <label htmlFor="status" className="field-label">
              Stage
            </label>
            <select
              id="status"
              name="status"
              defaultValue={query.status ?? ''}
              className="field-input"
            >
              <option value="">Any</option>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-mist-200 pt-4">
          <button type="submit" className="btn-primary btn-sm">
            Filter
          </button>
          {isFiltered ? (
            <Link href={basePath} className="btn-ghost btn-sm">
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      <Suspense key={JSON.stringify(query)} fallback={<SkeletonList label="Loading applicants…" />}>
        <ApplicantResults
          jobId={id}
          ownerId={hr._id}
          query={query}
          rawParams={rawParams}
          isFiltered={isFiltered}
        />
      </Suspense>
    </>
  );
}

async function ApplicantResults({
  jobId,
  ownerId,
  query,
  rawParams,
  isFiltered,
}: {
  jobId: string;
  ownerId: Types.ObjectId;
  query: ApplicantsQuery;
  rawParams: Record<string, string>;
  isFiltered: boolean;
}) {
  const { applicants, total } = await listApplicantsForJob(jobId, ownerId, query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const basePath = `/hr/jobs/${jobId}/applicants`;

  return (
    <>
      {applicants.length === 0 ? (
        isFiltered ? (
          <EmptyState
            title="No applicant matches those filters"
            description="No applicant to this role fits that name or stage. Clear the filters to see the whole pipeline again."
            action={{ href: basePath, label: 'Show me everyone' }}
          />
        ) : (
          <EmptyState
            title="Quiet so far"
            description="Nobody has applied yet. When they do, they arrive here with their resume and cover note, and you move them along from this page."
            secondary={{ href: '/hr/candidates', label: 'Go find people instead' }}
          />
        )
      ) : (
        <ul className="stagger space-y-4">
          {applicants.map((applicant) => (
            <li key={applicant.id} className="card">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-display-sm font-semibold">
                    {applicant.candidate?.name ?? 'Candidate removed'}
                  </h2>

                  {applicant.candidate ? (
                    <p className="mt-1.5 break-words text-sm text-ink-muted">
                      <a href={`mailto:${applicant.candidate.email}`} className="link">
                        {applicant.candidate.email}
                      </a>
                      {applicant.candidate.phone ? (
                        <span className="ml-2">· {applicant.candidate.phone}</span>
                      ) : null}
                    </p>
                  ) : null}

                  {applicant.candidate?.headline ? (
                    <p className="mt-1.5 text-sm text-ink-soft">{applicant.candidate.headline}</p>
                  ) : null}

                  <p className="mt-1 text-xs text-ink-faint">
                    Applied {new Date(applicant.appliedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-4 lg:w-64 lg:items-end">
                  <PipelineRail status={applicant.status} className="w-full" />
                  <ApplicantStatusSelect
                    applicationId={applicant.id}
                    status={applicant.status}
                  />
                </div>
              </div>

              {applicant.candidate?.skills.length ? (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {applicant.candidate.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-md bg-mist-200 px-2 py-0.5 text-xs text-ink-soft"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              ) : null}

              {applicant.coverNote ? (
                <p
                  className="mt-4 max-w-prose whitespace-pre-line border-l-2 border-mist-300 pl-3.5
                    text-sm leading-relaxed text-ink-soft"
                >
                  {applicant.coverNote}
                </p>
              ) : null}

              <p className="mt-4 border-t border-mist-200 pt-4 text-sm">
                <a href={`/api/applications/${applicant.id}/resume`} className="link">
                  <span aria-hidden="true">↓</span> {applicant.resume.originalName}
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={query.page}
        totalPages={totalPages}
        total={total}
        buildHref={(page) => buildPageHref(basePath, rawParams, page)}
      />
    </>
  );
}
